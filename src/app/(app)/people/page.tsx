import { redirect } from "next/navigation";
import { JsonForm } from "@/components/json-form";
import { PageHead } from "@/components/ui";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/domain";
import { prisma } from "@/lib/db";
import { canManagePeople } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export default async function PeoplePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [users, departments] = await Promise.all([
    prisma.user.findMany({ include: { department: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <div>
      <PageHead kicker="Access" title="People" lede="One role each. The five trial logins are documented on the sign-in page and in the README." />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Title</th>
              <th>Department</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{ROLE_LABEL[user.role as Role] ?? user.role}</td>
                <td>{user.title}</td>
                <td>{user.department?.name}</td>
                <td>{user.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canManagePeople(session.role) ? (
        <section className="card" style={{ marginTop: 14 }}>
          <h2>Add a person</h2>
          <JsonForm action="/api/people" submitLabel="Create account" successHref="/people">
            <div className="form-grid">
              <label>
                Name
                <input name="name" required />
              </label>
              <label>
                Email
                <input name="email" type="email" required />
              </label>
              <label>
                Role
                <select name="role" defaultValue="STAFF">
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABEL[role]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Department
                <select name="departmentId">
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Title
                <input name="title" required />
              </label>
              <label>
                Password
                <input name="password" type="password" required minLength={8} />
              </label>
            </div>
          </JsonForm>
        </section>
      ) : null}
    </div>
  );
}
