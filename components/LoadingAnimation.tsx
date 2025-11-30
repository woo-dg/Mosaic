'use client'

import { motion } from 'framer-motion'

export default function LoadingAnimation() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white overflow-hidden">
      <motion.div
        initial={{ x: -400, opacity: 0, rotate: -15 }}
        animate={{ 
          x: 0, 
          opacity: 1, 
          rotate: 0,
        }}
        transition={{
          type: 'spring',
          damping: 12,
          stiffness: 120,
          duration: 0.8,
        }}
        className="text-center relative"
      >
        <motion.div
          animate={{
            y: [0, -15, 0],
            rotate: [0, -2, 0],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.8,
          }}
          className="text-8xl font-bold text-gray-900 relative"
        >
          M
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="mt-4 text-lg text-gray-600"
        >
          Loading your experience...
        </motion.p>
      </motion.div>
    </div>
  )
}
