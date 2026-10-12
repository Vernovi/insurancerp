import { redirect } from "next/navigation";
import { JsonForm } from "@/components/json-form";
import { PageHead } from "@/components/ui";
import { CATEGORY_LABEL, LINES_OF_BUSINESS, RISK_CATEGORIES, RISK_STATUSES, TREATMENTS, TRENDS } from "@/lib/domain";
import { prisma } from "@/lib/db";
import { canManageRisks } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export default async function NewRiskPage() {
  const session = await getSession();
  if (!session || !canManageRisks(session.role)) redirect("/?denied=1");
  const [departments, users] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div>
      <PageHead kicker="Risk register" title="Add a risk" lede="Inherent and residual scores are calculated as likelihood × impact." />
      <section className="card">
        <JsonForm action="/api/risks" submitLabel="Save risk" successHref="/risks">
          <div className="form-grid">
            <label className="wide">
              Title
              <input name="title" required data-testid="risk-title" />
            </label>
            <label className="wide">
              Description
              <textarea name="description" required />
            </label>
            <label>
              Category
              <select name="category">
                {RISK_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABEL[category]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Line of business
              <select name="lineOfBusiness" data-testid="risk-line">
                {LINES_OF_BUSINESS.map((line) => (
                  <option key={line}>{line}</option>
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
              Owner
              <select name="ownerId">
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Inherent likelihood
              <select name="likelihoodInherent" defaultValue="3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Inherent impact
              <select name="impactInherent" defaultValue="3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Residual likelihood
              <select name="likelihoodResidual" defaultValue="2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Residual impact
              <select name="impactResidual" defaultValue="2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Treatment
              <select name="treatment">
                {TREATMENTS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select name="status" defaultValue="OPEN">
                {RISK_STATUSES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Trend
              <select name="trend" defaultValue="STABLE">
                {TRENDS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Emerging
              <select name="emerging" defaultValue="no">
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </label>
            <label className="wide">
              Strategic objective
              <input name="strategicObjective" required />
            </label>
          </div>
        </JsonForm>
      </section>
    </div>
  );
}
