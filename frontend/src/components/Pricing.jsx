function Pricing() {
  return (
    <section id="pricing" className="pricing">

      <h2>Pricing</h2>

      <div className="pricing-grid">

        <div className="price-card">
          <h3>Free Trial</h3>
          <p>7 Days Free</p>
          <p>100 DMs</p>
          <p>1 Account</p>
        </div>

        <div className="price-card featured">
          <h3>Starter</h3>
          <p>₹499 / month</p>
          <p>1000 DMs</p>
          <p>Unlimited Campaigns</p>
        </div>

        <div className="price-card">
          <h3>Growth</h3>
          <p>₹999 / month</p>
          <p>5000 DMs</p>
          <p>Priority Support</p>
        </div>

      </div>
    </section>
  );
}

export default Pricing;