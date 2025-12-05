import Link from 'next/link'

export default function ThanksPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <div className="text-green-600 text-6xl mb-4">✓</div>
        <h1 className="text-3xl font-bold mb-4">Thank You!</h1>
        <p className="text-gray-600 mb-6">
          Your photos have been uploaded successfully and will be reviewed by our team.
        </p>
        <p className="text-sm text-gray-500">
          We appreciate you taking the time to share your experience with us.
        </p>
      </div>
    </div>
  )
}





