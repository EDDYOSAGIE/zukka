import { PageHeader, Card } from "../components/Layout";

export function ContactPage() {
  return (
    <div className="pb-24">
      <PageHeader title="Contact" copy="Get in touch with the Zukka team for partnerships, support, or merchant onboarding." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="text-xl font-black">Support</h3>
          <p className="mt-3 text-sm text-slatecopy">Email: QognitoEnergies@gmail.com</p>
        </Card>
        <Card>
          <h3 className="text-xl font-black">Partnerships</h3>
          <p className="mt-3 text-sm text-slatecopy">For merchant onboarding and integration enquiries, reach out and we'll respond within 48 hours.</p>
        </Card>
      </div>
    </div>
  );
}

export default ContactPage;
