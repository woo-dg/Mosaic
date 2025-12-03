import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 md:p-8">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-800 mb-6 inline-block"
          >
            ← Back
          </Link>
          
          <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
          
          <div className="prose max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">How We Use Your Submissions</h2>
              <p className="text-gray-700">
                When you submit photos and feedback through our platform, your content is sent 
                privately to the restaurant's management team. Your submissions are not shared 
                publicly unless you explicitly grant permission for marketing use.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Private Sharing</h2>
              <p className="text-gray-700">
                By default, all submissions are kept private and are only accessible to 
                authorized restaurant staff members who have logged into the secure dashboard. 
                Your photos and feedback are stored securely and are not visible to the public 
                or other restaurants.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Marketing Consent</h2>
              <p className="text-gray-700">
                If you choose to allow your content to be used for marketing purposes, the 
                restaurant may use your photos and feedback in their social media posts, 
                advertisements, or other promotional materials. You can indicate this preference 
                when submitting your content. If you do not grant marketing consent, your 
                content will remain for internal use only.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Data Access</h2>
              <p className="text-gray-700">
                Only authorized restaurant managers and staff who have been granted access to 
                the restaurant's dashboard can view your submissions. Each restaurant's data 
                is isolated and cannot be accessed by other restaurants or unauthorized parties.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Data Retention</h2>
              <p className="text-gray-700">
                Your submissions are stored securely and retained for as long as the restaurant 
                maintains their account. If you wish to have your content removed, please contact 
                the restaurant directly.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">Contact</h2>
              <p className="text-gray-700">
                If you have questions about how your data is used or wish to request removal of 
                your content, please contact the restaurant directly through their official 
                channels.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}



