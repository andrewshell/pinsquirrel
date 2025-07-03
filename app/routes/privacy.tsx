import type { Route } from './+types/privacy';

export function meta(_: Route.MetaArgs) {
  return [
    { title: 'Privacy Policy - PinSquirrel' },
    {
      name: 'description',
      content:
        'Privacy Policy for PinSquirrel - learn how we protect your data and privacy.',
    },
  ];
}

export default function Privacy() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>

      <div className="prose prose-gray max-w-none">
        <p className="text-gray-600 mb-6">
          <strong>Last updated:</strong> {new Date().toLocaleDateString()}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            1. Information We Collect
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            We collect information you provide directly to us, such as when you
            create an account, use our services, or contact us for support.
          </p>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Personal Information
          </h3>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
            <li>Name and email address</li>
            <li>Account credentials</li>
            <li>Link collections, bookmarks, and preferences</li>
            <li>Reading lists and RSS feed subscriptions</li>
            <li>Usage information and analytics</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            2. How We Use Your Information
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            We use the information we collect to:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Provide, maintain, and improve our services</li>
            <li>Process transactions and send related information</li>
            <li>Send technical notices and support messages</li>
            <li>Respond to your comments and questions</li>
            <li>Monitor and analyze usage patterns</li>
            <li>Detect and prevent fraud and abuse</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            3. Information Sharing
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            We do not sell, trade, or otherwise transfer your personal
            information to third parties except as described in this policy:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>With your consent</li>
            <li>To comply with legal obligations</li>
            <li>To protect our rights and safety</li>
            <li>With service providers who assist our operations</li>
            <li>In connection with a merger or acquisition</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            4. Data Security
          </h2>
          <p className="text-gray-700 leading-relaxed">
            We implement appropriate technical and organizational security
            measures to protect your personal information against unauthorized
            access, alteration, disclosure, or destruction. However, no method
            of transmission over the internet or electronic storage is 100%
            secure.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            5. Data Retention
          </h2>
          <p className="text-gray-700 leading-relaxed">
            We retain your personal information for as long as necessary to
            provide our services, comply with legal obligations, resolve
            disputes, and enforce our agreements. When you delete your account,
            we will delete your personal information within 30 days.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            6. Your Rights
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Depending on your location, you may have the following rights
            regarding your personal information:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Access and portability of your data</li>
            <li>Correction of inaccurate information</li>
            <li>Deletion of your data</li>
            <li>Restriction of processing</li>
            <li>Objection to processing</li>
            <li>Withdrawal of consent</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            7. Cookies and Tracking
          </h2>
          <p className="text-gray-700 leading-relaxed">
            We use cookies and similar tracking technologies to collect
            information about your browsing activities. You can control cookies
            through your browser settings, though this may affect the
            functionality of our service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            8. Third-Party Services
          </h2>
          <p className="text-gray-700 leading-relaxed">
            Our service may contain links to third-party websites or services.
            We are not responsible for the privacy practices of these third
            parties. We encourage you to review their privacy policies.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            9. Children&apos;s Privacy
          </h2>
          <p className="text-gray-700 leading-relaxed">
            Our service is not intended for children under 13. We do not
            knowingly collect personal information from children under 13. If
            you become aware that a child has provided us with personal
            information, please contact us.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            10. International Transfers
          </h2>
          <p className="text-gray-700 leading-relaxed">
            Your information may be transferred to and processed in countries
            other than your own. We ensure appropriate safeguards are in place
            to protect your personal information in accordance with this privacy
            policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            11. Changes to This Policy
          </h2>
          <p className="text-gray-700 leading-relaxed">
            We may update this privacy policy from time to time. We will notify
            you of any changes by posting the new privacy policy on this page
            and updating the &quot;Last updated&quot; date.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            12. Contact Us
          </h2>
          <p className="text-gray-700 leading-relaxed">
            If you have any questions about this Privacy Policy, please contact
            us at andrew@pinsquirrel.com or write to us at:
          </p>
          <div className="mt-4 p-4 bg-gray-50 rounded-md">
            <p className="text-gray-700">
              Andrew Shell LLC
              <br />
              1941 Dolores Dr
              <br />
              Madison, WI 53716
              <br />
              United States
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
