import './LoadingScreen.css'

function LoadingScreen({ leaving }) {
  return (
    <div className={leaving ? 'loading-screen leaving' : 'loading-screen'}>
      <div className="loading-blur"></div>
      <div className="loading-content">
        <img src="/middleman-loading.webp" alt="Middleman" className="loading-mark" />
        <span className="loading-word">middleman</span>
        <div className="loading-bar"><i></i></div>
      </div>
    </div>
  )
}

export default LoadingScreen
