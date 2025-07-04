import type { Route } from './+types/terms';

export function meta(_: Route.MetaArgs) {
  return [
    { title: 'Terms of Service - PinSquirrel' },
    {
      name: 'description',
      content: 'Terms of Service for PinSquirrel - link hoarding platform.',
    },
  ];
}

export default function Terms() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">
        Terms of Service
      </h1>

      <div className="prose prose-gray max-w-none">
        <p className="text-gray-600 mb-6">
          <strong>Last updated:</strong> {new Date().toLocaleDateString()}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            1. Acceptance of Terms
          </h2>
          <p className="text-gray-700 leading-relaxed">
            By accessing and using PinSquirrel, you accept and agree to be bound
            by the terms and provision of this agreement. If you do not agree to
            abide by the above, please do not use this service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            2. Use License
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Permission is granted to temporarily use PinSquirrel for personal,
            non-commercial transitory viewing only. This is the grant of a
            license, not a transfer of title, and under this license you may
            not:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>modify or copy the materials</li>
            <li>
              use the materials for any commercial purpose or for any public
              display
            </li>
            <li>
              attempt to reverse engineer any software contained on the website
            </li>
            <li>
              remove any copyright or other proprietary notations from the
              materials
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            3. User Accounts
          </h2>
          <p className="text-gray-700 leading-relaxed">
            When you create an account with us, you must provide information
            that is accurate, complete, and current at all times. You are
            responsible for safeguarding the password and for all activities
            that occur under your account.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            4. Privacy Policy
          </h2>
          <p className="text-gray-700 leading-relaxed">
            Your privacy is important to us. Please review our Privacy Policy,
            which also governs your use of the Service, to understand our
            practices.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            5. Prohibited Uses
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            You may not use our service:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>
              For any unlawful purpose or to solicit others to perform acts
            </li>
            <li>
              To violate any international, federal, provincial, or state
              regulations, rules, laws, or local ordinances
            </li>
            <li>
              To infringe upon or violate our intellectual property rights or
              the intellectual property rights of others
            </li>
            <li>
              To harass, abuse, insult, harm, defame, slander, disparage,
              intimidate, or discriminate
            </li>
            <li>To submit false or misleading information</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            6. Service Availability
          </h2>
          <p className="text-gray-700 leading-relaxed">
            We reserve the right to withdraw or amend this service, and any
            service or material we provide on the website, in our sole
            discretion without notice. We will not be liable if for any reason
            all or any part of the service is unavailable at any time or for any
            period.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            7. Disclaimer
          </h2>
          <p className="text-gray-700 leading-relaxed">
            The information on this website is provided on an &apos;as is&apos;
            basis. To the fullest extent permitted by law, this Company excludes
            all representations, warranties, conditions and terms related to our
            website and the use of this website.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            8. Governing Law
          </h2>
          <p className="text-gray-700 leading-relaxed">
            These terms and conditions are governed by and construed in
            accordance with the laws and you irrevocably submit to the exclusive
            jurisdiction of the courts in that state or location.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            9. Changes to Terms
          </h2>
          <p className="text-gray-700 leading-relaxed">
            We reserve the right, at our sole discretion, to modify or replace
            these Terms at any time. If a revision is material, we will try to
            provide at least 30 days notice prior to any new terms taking
            effect.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            10. Contact Information
          </h2>
          <p className="text-gray-700 leading-relaxed">
            If you have any questions about these Terms of Service, please
            contact us at:
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
              <br />
              Email: andrew@pinsquirrel.com
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
