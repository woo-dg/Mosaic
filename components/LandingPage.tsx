'use client'

import { motion } from 'framer-motion'

interface LandingPageProps {
  restaurantName: string
  restaurantSlug: string
  onViewPhotos: () => void
}

export default function LandingPage({ restaurantName, restaurantSlug, onViewPhotos }: LandingPageProps) {

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* M Logo Animation */}
      <motion.div
        initial={{ x: -300, opacity: 0, rotate: -10 }}
        animate={{ 
          x: 0, 
          opacity: 1, 
          rotate: 0,
        }}
        transition={{
          type: 'spring',
          damping: 15,
          stiffness: 200,
          duration: 0.5,
        }}
        className="text-center relative mb-8"
      >
        <motion.div
          animate={{
            y: [0, -12, 0],
            rotate: [0, -1, 0],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.5,
          }}
          className="text-8xl font-bold text-gray-900 relative"
        >
          M
        </motion.div>
      </motion.div>

      {/* Text Sections */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="text-center space-y-3 mb-8"
      >
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.4 }}
          className="text-2xl sm:text-3xl font-bold text-gray-900"
        >
          Share Photos
        </motion.h2>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.4 }}
          className="text-2xl sm:text-3xl font-bold text-gray-900"
        >
          Get Featured
        </motion.h2>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.4 }}
          className="text-2xl sm:text-3xl font-bold text-gray-900"
        >
          Help Restaurants
        </motion.h2>
      </motion.div>

      {/* View and Share Photos Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <button
          onClick={onViewPhotos}
          className="w-full bg-gray-900 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-800 active:bg-gray-700 transition-all shadow-lg touch-manipulation"
        >
          View and Share Photos
        </button>
      </motion.div>
    </div>
  )
}

