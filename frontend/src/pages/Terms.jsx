/**
 * Terms of Service page.
 */
export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-10">
      <div>
        <h1 className="text-white text-2xl font-bold mb-2">Terms of Service</h1>
        <p className="text-white/40 text-xs">Last updated: June 2026</p>
      </div>

      <Section title="The service">
        <p>
          PredictTheBall is a free-to-use Premier League prediction game. Before each
          season kicks off, a predicted final table can be submitted. Scores are
          calculated against the live standings throughout the season and updated as
          results come in. Private leagues allow users to compete against others using
          a shared invite code.
        </p>
        <p className="mt-3">
          There is no prize money or monetary reward of any kind. This is purely a game.
        </p>
      </Section>

      <Section title="Eligibility">
        <p>
          Users must be at least 13 years old to create an account. By registering, you
          confirm that the information provided is accurate and that use of the service
          is not prohibited under any applicable law.
        </p>
      </Section>

      <Section title="Your account">
        <ul className="space-y-2 list-disc list-inside text-white/60 text-sm">
          <li>Login credentials are the account holder's responsibility to keep secure.</li>
          <li>
            Accounts must not be shared, and access to another person's account without
            permission is not permitted.
          </li>
          <li>
            If unauthorised access is suspected, the password should be changed
            immediately and the service contacted.
          </li>
          <li>
            Accounts can be deleted at any time from the Settings page. Deletion is
            permanent and irreversible.
          </li>
        </ul>
      </Section>

      <Section title="Predictions and leagues">
        <p>
          Predictions can be submitted and updated at any time before a season's deadline.
          Once a season has kicked off and the deadline has passed, submissions are locked.
        </p>
        <p className="mt-3">
          Private leagues are identified by a short invite code. Anyone with the code can
          join. Codes should not be shared publicly if restricted membership is intended.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>Users agree not to:</p>
        <ul className="mt-2 space-y-2 list-disc list-inside text-white/60 text-sm">
          <li>Attempt to gain unauthorised access to any part of the service or its infrastructure.</li>
          <li>Use automated scripts to submit or manipulate predictions.</li>
          <li>Harass, impersonate, or abuse other users.</li>
          <li>Use the service for any unlawful purpose.</li>
        </ul>
        <p className="mt-3">
          Accounts that breach these rules may be suspended or terminated without prior notice.
        </p>
      </Section>

      <Section title="Intellectual property">
        <p>
          The ELO-based model predictions, site design, and code belong to
          PredictTheBall. Football club names, badges, and related marks are the property
          of their respective owners. PredictTheBall is not affiliated with the Premier
          League or any football club.
        </p>
      </Section>

      <Section title="Disclaimer">
        <p>
          The service is provided as-is, without any warranty of availability, accuracy,
          or fitness for a particular purpose. Model predictions are generated
          algorithmically and are not financial or betting advice. No responsibility is
          accepted for any loss arising from use of the service.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          These terms may be updated from time to time. The date at the top of this page
          reflects the most recent revision. Continued use of the service after an update
          constitutes acceptance of the new terms.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these terms?{' '}
          <a
            href="mailto:predict.the.ball.app@gmail.com"
            className="text-teal hover:text-teal-muted transition-colors"
          >
            predict.the.ball.app@gmail.com
          </a>
        </p>
      </Section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-jet-dark rounded-2xl p-6 md:p-8">
      <h2 className="text-white font-semibold text-base mb-3">{title}</h2>
      <div className="text-white/60 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  )
}
