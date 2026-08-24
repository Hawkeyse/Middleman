import { useEffect, useRef, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, Camera, Car, CreditCard, Fingerprint, IdCard, Loader2, RefreshCw, Sun, Upload } from 'lucide-react'
import Icon from '../components/Icon.jsx'
import { useAppState } from '../state/AppState.jsx'
import { countries } from '../state/countries.js'
import './Verify.css'

const docTypes = [
  { id: 'passport', label: 'International Passport', icon: Fingerprint },
  { id: 'national-id', label: 'National ID Card', icon: CreditCard },
  { id: 'license', label: "Driver's License", icon: Car },
  { id: 'ghana-card', label: 'Ghana Card', icon: IdCard },
]

const MIN_AGE = 18

function calcAge(dob) {
  if (!dob) return null
  const birth = new Date(dob)
  if (Number.isNaN(birth.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--
  return age
}

function Verify() {
  const location = useLocation()
  const { verification, verificationMeta, submitForReview } = useAppState()
  const returnTo = location.state?.from || '/profile'

  const [step, setStep] = useState(1)
  const [country, setCountry] = useState('')
  const [dob, setDob] = useState('')
  const [docType, setDocType] = useState(null)
  const [docImage, setDocImage] = useState(null)
  const [selfie, setSelfie] = useState(null)
  const [cameraError, setCameraError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState(null)
  const [checkError, setCheckError] = useState('')

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const age = calcAge(dob)
  const ageError = !dob || age === null ? '' : age < MIN_AGE ? `You need to be at least ${MIN_AGE} to use Middleman.` : age > 120 ? 'Check that date of birth.' : ''

  // Ghana Card only makes sense for a Ghanaian applicant — don't offer it to
  // everyone else, and drop it if they'd already picked it then changed country.
  const availableDocTypes = docTypes.filter((d) => d.id !== 'ghana-card' || country === 'Ghana')
  useEffect(() => {
    if (docType === 'ghana-card' && country !== 'Ghana') setDocType(null)
  }, [country, docType])

  useEffect(() => {
    if (step !== 4 || selfie) return
    let cancelled = false
    navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: 'user' } })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => setCameraError(true))
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [step, selfie])

  // Phone camera photos can be several MB — downscale before it goes into
  // localStorage or over the wire to the automated check below.
  const handleDocUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const maxDim = 1600
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        setDocImage(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  }

  const captureSelfie = () => {
    const video = videoRef.current
    if (video && video.videoWidth) {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d').drawImage(video, 0, 0)
      setSelfie(canvas.toDataURL('image/jpeg', 0.85))
    } else {
      setSelfie('sample')
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }

  // Gives the applicant a moment to get their face centered and well-lit
  // before we actually take the photo, instead of capturing the instant
  // they click — matches how most real ID-verification flows behave.
  const startCapture = () => {
    if (cameraError || !videoRef.current?.videoWidth) { captureSelfie(); return }
    setCountdown(3)
  }

  useEffect(() => {
    if (countdown === null) return
    if (countdown === 0) { captureSelfie(); setCountdown(null); return }
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 800)
    return () => window.clearTimeout(t)
  }, [countdown])

  // Automated pre-filter (see api/verify/check.js) — catches an obviously
  // missing face or an invalid/expired/troll document before it reaches the
  // team's review queue. If the check itself fails (no API key, network,
  // OpenAI down) we don't block on it — the team still reviews manually.
  useEffect(() => {
    if (!selfie || selfie === 'sample' || !docImage) return
    let cancelled = false
    setChecking(true)
    setCheckError('')
    setCheckResult(null)
    fetch('/api/verify/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docImage, docType, selfieImage: selfie }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || 'Automated check failed')
        if (!cancelled) setCheckResult(data)
      })
      .catch((err) => { if (!cancelled) setCheckError(err.message) })
      .finally(() => { if (!cancelled) setChecking(false) })
    return () => { cancelled = true }
  }, [selfie])

  const retakeSelfie = () => { setSelfie(null); setCheckResult(null); setCheckError('') }
  const backToDocument = () => { setDocImage(null); setSelfie(null); setCheckResult(null); setCheckError(''); setStep(3) }

  const submit = () => {
    setSubmitting(true)
    window.setTimeout(() => {
      submitForReview({ country, dob, age, docType, docImage, selfieImage: selfie === 'sample' ? docImage : selfie })
      setSubmitting(false)
      setStep(5)
    }, 1400)
  }

  // Already mid-review or resolved — don't let them re-enter the upload flow.
  if (verification === 'pending' && step < 5) {
    return (
      <div className="verify-page">
        <VerifyHeader returnTo={returnTo} />
        <div className="verify-card">
          <div className="verify-step verify-center">
            <div className="verify-status-icon pending"><Icon name="pending" size={28} /></div>
            <h2>Your documents are under review</h2>
            <p>Our team is checking what you submitted{verificationMeta?.submittedAt ? ` on ${new Date(verificationMeta.submittedAt).toLocaleDateString()}` : ''}. This usually takes a little while — we'll let you know as soon as it's approved. No need to submit again.</p>
            <Link className="verify-next" to={returnTo}>Back</Link>
          </div>
        </div>
      </div>
    )
  }

  if (verification === 'verified' && step < 5) {
    return (
      <div className="verify-page">
        <VerifyHeader returnTo={returnTo} />
        <div className="verify-card">
          <div className="verify-step verify-center">
            <div className="verify-status-icon verified"><BadgeCheck size={28} /></div>
            <h2>You're already verified</h2>
            <p>No need to do this again — your identity is confirmed.</p>
            <Link className="verify-next" to={returnTo}>Back</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="verify-page">
      <VerifyHeader returnTo={returnTo} label={step === 5 ? 'Done' : 'Cancel'} />

      <div className="verify-card">
        {step < 5 && <div className="verify-progress"><i style={{ width: `${(step / 4) * 100}%` }}></i></div>}

        {verification === 'declined' && step === 1 && (
          <div className="decline-banner"><Icon name="alarm" size={16} /> Your last submission was declined{verificationMeta?.reason ? `: ${verificationMeta.reason}` : '.'} Please check your details and try again.</div>
        )}

        {step === 1 && (
          <div className="verify-step">
            <span className="verify-eyebrow">STEP 1 OF 4</span>
            <h2>Tell us about you</h2>
            <p>Middleman works worldwide — we just need to know where you're based and confirm you're old enough to hold funds in escrow.</p>
            <div className="verify-field">
              <label htmlFor="country">Country</label>
              <select id="country" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="" disabled>Select your country</option>
                {countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="verify-field">
              <label htmlFor="dob">Date of birth</label>
              <input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              {age !== null && !ageError && <span className="age-hint">That makes you {age} years old.</span>}
              {ageError && <span className="age-error">{ageError}</span>}
            </div>
            <button className="verify-next" disabled={!country || !dob || !!ageError} onClick={() => setStep(2)}>Continue</button>
          </div>
        )}

        {step === 2 && (
          <div className="verify-step">
            <span className="verify-eyebrow">STEP 2 OF 4</span>
            <h2>Choose a document</h2>
            <p>Pick the ID you'll upload next.</p>
            <div className="doc-grid">
              {availableDocTypes.map((doc) => {
                const Icon = doc.icon
                return (
                  <button key={doc.id} className={docType === doc.id ? 'doc-option selected' : 'doc-option'} onClick={() => setDocType(doc.id)}>
                    <Icon size={22} />
                    <span>{doc.label}</span>
                  </button>
                )
              })}
            </div>
            <button className="verify-next" disabled={!docType} onClick={() => setStep(3)}>Continue</button>
          </div>
        )}

        {step === 3 && (
          <div className="verify-step">
            <span className="verify-eyebrow">STEP 3 OF 4</span>
            <h2>Upload your {docTypes.find((d) => d.id === docType)?.label}</h2>
            <p>Make sure the photo, name and date of birth are clear and readable.</p>
            <label className="doc-upload">
              {docImage ? <img src={docImage} alt="Uploaded document" /> : <><Upload size={22} /><span>Click to upload a photo of your document</span></>}
              <input type="file" accept="image/*" onChange={handleDocUpload} hidden />
            </label>
            <button className="verify-next" disabled={!docImage} onClick={() => setStep(4)}>Continue</button>
          </div>
        )}

        {step === 4 && (
          <div className="verify-step">
            <span className="verify-eyebrow">STEP 4 OF 4</span>
            <h2>Take a live selfie</h2>
            <p>This confirms the person applying is the person on the document.</p>
            {!selfie && !cameraError && (
              <div className="selfie-tip"><Sun size={14} /> Find good lighting and fit your whole face in the oval — no hats, sunglasses or shadows.</div>
            )}
            <div className="selfie-frame">
              {selfie
                ? <img src={selfie === 'sample' ? docImage : selfie} alt="Captured selfie" />
                : cameraError
                  ? <div className="selfie-fallback"><Camera size={26} /><span>Camera unavailable in this browser/session.</span></div>
                  : <>
                      <video ref={videoRef} autoPlay playsInline muted></video>
                      <div className={countdown !== null ? 'selfie-guide scanning' : 'selfie-guide'}>
                        <div className="selfie-oval"></div>
                        {countdown !== null && <div className="selfie-scan-line"></div>}
                      </div>
                      {countdown !== null && countdown > 0 && <div className="selfie-countdown">{countdown}</div>}
                    </>}
            </div>
            {selfie && checking && <div className="check-status checking"><Loader2 size={14} className="spin" /> Checking your photos…</div>}
            {selfie && !checking && checkResult && !checkResult.overallOk && (
              <div className="check-status issue"><Icon name="alarm" size={14} /> {checkResult.summary}</div>
            )}
            {selfie && !checking && checkError && (
              <div className="check-status note">Automated check unavailable — your submission will go straight to manual review.</div>
            )}

            {selfie
              ? <button className="verify-next ghost" onClick={retakeSelfie}><RefreshCw size={15} /> Retake selfie</button>
              : countdown !== null
                ? <button className="verify-next ghost" onClick={() => setCountdown(null)}>Cancel</button>
                : <button className="verify-next" onClick={startCapture}><Camera size={16} /> {cameraError ? 'Simulate capture' : 'Start scan'}</button>}

            {selfie && checkResult && !checkResult.overallOk && (checkResult.retryTarget === 'document' || checkResult.retryTarget === 'both') && (
              <button className="verify-next ghost" onClick={backToDocument}><Upload size={15} /> Re-upload document</button>
            )}

            {selfie && (checkError || !checkResult || checkResult.overallOk) && (
              <button className="verify-next" disabled={submitting || checking} onClick={submit}>{submitting ? <><Loader2 size={16} className="spin" /> Submitting…</> : 'Submit for review'}</button>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="verify-step verify-center">
            <div className="verify-status-icon pending"><Icon name="pending" size={28} /></div>
            <h2>Thanks — hang tight</h2>
            <p>We've received your details, document and selfie. Our team will check them and approve or decline your verification. This can take a little while, so please be patient — you'll be able to start deals as soon as you're approved.</p>
            <Link className="verify-next" to={returnTo}>Back to {returnTo === '/dashboard' ? 'dashboard' : 'profile'}</Link>
          </div>
        )}
      </div>
    </div>
  )
}

function VerifyHeader({ returnTo, label }) {
  return (
    <header className="verify-nav">
      <Link className="verify-back" to={returnTo}><ArrowLeft size={14} /> {label || 'Cancel'}</Link>
      <div className="verify-brand"><img src="/middleman-logo.png" alt="Middleman" /><span>middleman</span></div>
    </header>
  )
}

export default Verify
