import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="navbar">
      <h2>TriggerDM</h2>

      <div className="nav-links">
        <a href="#features">Features</a>
        <a href="#pricing">Pricing</a>

        <Link to="/login">
          <button className="login-btn">Login</button>
        </Link>
      </div>
    </nav>
  );
}

export default Navbar;