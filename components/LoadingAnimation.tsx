'use client'

import { motion } from 'framer-motion'

export default function LoadingAnimation() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white overflow-hidden">
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
        className="text-center relative"
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
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="mt-4 text-lg text-gray-600"
        >
          Loading your experience...
        </motion.p>
      </motion.div>
    </div>
  )
}

import { motion } from 'framer-motion'

export default function LoadingAnimation() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white overflow-hidden">
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
        className="text-center relative"
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
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="mt-4 text-lg text-gray-600"
        >
          Loading your experience...
        </motion.p>
      </motion.div>
    </div>
  )
}
