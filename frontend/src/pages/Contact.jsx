import LegalLayout from "../components/LegalLayout";

function Contact() {
  return (
    <LegalLayout
      title="Contact Us"
      updated="July 2026"
    >
      <p>
        We'd love to hear from you.
      </p>

      <h2>Support</h2>

      <p>
        Email:{" "}
        <a href="mailto:support@triggerdm.in" style={{ color: "inherit", textDecoration: "underline" }}>
          support@triggerdm.in
        </a>
      </p>

      <h2>Business</h2>

      <p>
        TriggerDM
        <br />
        https://triggerdm.in
      </p>

      <h2>Response Time</h2>

      <p>
        We typically respond within 24–48 business hours.
      </p>
    </LegalLayout>
  );
}

export default Contact;