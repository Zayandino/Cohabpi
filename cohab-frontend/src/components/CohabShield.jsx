

export default function CohabShield({ className = '', style = {} }) {
  return (
    <div className={`shield-container ${className}`} style={{ ...style, width: '100%', maxWidth: '400px', margin: '0 auto' }}>
      <svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <defs>
          <path id="top-curve" d="M 100 250 A 150 150 0 0 1 400 250" fill="transparent" />
          <path id="bottom-curve" d="M 400 250 A 150 150 0 0 1 100 250" fill="transparent" />
          
          <linearGradient id="shield-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0B132B" />
            <stop offset="100%" stopColor="#1C2541" />
          </linearGradient>
        </defs>

        {/* Outer Circles */}
        <circle cx="250" cy="250" r="230" fill="url(#shield-grad)" stroke="#3A506B" strokeWidth="4" />
        <circle cx="250" cy="250" r="215" fill="transparent" stroke="#5BC0BE" strokeWidth="2" strokeDasharray="8 4" />

        {/* Text Paths */}
        <text fontSize="28" fontWeight="900" fill="#FFFFFF" letterSpacing="6">
          <textPath href="#top-curve" startOffset="50%" textAnchor="middle">
            BRAZILIAN JIU-JITSU
          </textPath>
        </text>
        
        <text fontSize="26" fontWeight="700" fill="#5BC0BE" letterSpacing="8">
          <textPath href="#bottom-curve" startOffset="50%" textAnchor="middle">
            LOS ANDES
          </textPath>
        </text>

        {/* Andes Mountains Silhouette */}
        <path d="M 120 200 L 160 140 L 190 170 L 250 100 L 300 160 L 340 120 L 380 200 Z" fill="#3A506B" opacity="0.6" />

        {/* Red Vertical Seal (Kanji) */}
        <rect x="40" y="160" width="40" height="180" rx="8" fill="#E63946" />
        <text x="60" y="210" fontSize="24" fontWeight="bold" fill="#FFF" textAnchor="middle">柔</text>
        <text x="60" y="250" fontSize="24" fontWeight="bold" fill="#FFF" textAnchor="middle">術</text>

        {/* Right side APJJ patch */}
        <rect x="420" y="200" width="40" height="100" rx="8" fill="#1C2541" stroke="#5BC0BE" strokeWidth="2" />
        <text x="440" y="235" fontSize="16" fontWeight="bold" fill="#5BC0BE" textAnchor="middle" transform="rotate(90 440 235)">APJJ</text>

        {/* Central Banner */}
        <rect x="110" y="220" width="280" height="80" rx="10" fill="#0B132B" stroke="#E63946" strokeWidth="3" />
        <text x="250" y="260" fontSize="42" fontWeight="900" fill="#FFFFFF" textAnchor="middle" fontFamily="sans-serif">
          COHAB
        </text>
        <text x="250" y="285" fontSize="14" fontWeight="600" fill="#E63946" textAnchor="middle" letterSpacing="4">
          NACIDOS PARA VENCER
        </text>

      </svg>
    </div>
  );
}
