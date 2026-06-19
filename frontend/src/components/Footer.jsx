import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer className="footer">

      <h3>TriggerDM</h3>

      <div className="footer-links">
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/contact">Contact</Link>
      </div>

      <p>support@triggerdm.in</p>

    </footer>
  );
}

export default Footer;