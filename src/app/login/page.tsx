import { LoginForm } from "@/components/login-form";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/data/demo-accounts";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="login-wrap">
      <section className="login-story">
        <div>
          <p className="kicker">Vernovi · InsuranceRP</p>
          <h1>Risk, conduct and the board pack in one place.</h1>
          <p>
            Trial tenant: Harbourline Assurance Plc, a fictional multi-line insurer writing motor, property, marine,
            energy, health, life and aviation.
          </p>
        </div>
        <p className="notice">Demo data only. Nothing here is a real company, customer or regulatory filing.</p>
      </section>
      <section className="login-panel">
        <h2>Sign in</h2>
        <p className="muted">Use a Harbourline trial account. The shared password is {DEMO_PASSWORD}.</p>
        <LoginForm next={params.next} />
        <div className="table-wrap" style={{ marginTop: 24 }}>
          <table className="demo-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_ACCOUNTS.map((account) => (
                <tr key={account.email}>
                  <td>{account.name}</td>
                  <td>{account.role}</td>
                  <td>{account.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
