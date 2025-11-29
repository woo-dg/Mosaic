'use client'

export default function LoadingAnimation() {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 z-50 flex items-center justify-center">
      <div className="text-center">
        <div className="relative">
          {/* M character with smiley face - Pixar lamp style animation */}
          <div className="animate-hop-in">
            <div className="text-7xl sm:text-8xl md:text-9xl font-bold text-blue-600 relative inline-block">
              <span className="inline-block relative">
                M
                {/* Smiley face positioned inside the M */}
                <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xl sm:text-2xl md:text-3xl pointer-events-none">
                  😊
                </span>
              </span>
            </div>
          </div>
        </div>
        <style jsx>{`
          @keyframes hop-in {
            0% {
              transform: translateY(100vh) scale(0.5);
              opacity: 0;
            }
            40% {
              transform: translateY(-30px) scale(1.15);
              opacity: 1;
            }
            50% {
              transform: translateY(0) scale(1);
            }
            60% {
              transform: translateY(-15px) scale(1.05);
            }
            70% {
              transform: translateY(0) scale(1);
            }
            100% {
              transform: translateY(0) scale(1);
            }
          }
          @keyframes bounce-gentle {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-10px);
            }
          }
          .animate-hop-in {
            animation: hop-in 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
                       bounce-gentle 2s ease-in-out 1.2s infinite;
          }
        `}</style>
      </div>
    </div>
  )
}

