import { useMemo } from "react";
import prototypeLanding from "../assets/prototype/index.html?raw";
import "../styles/prototype/pages/landing.css";

export default function LandingPage({ onGetStarted, onSignIn, onNavigate }) {
  const markup = useMemo(() => {
    const document = new DOMParser().parseFromString(prototypeLanding, "text/html");
    return document.body.innerHTML;
  }, []);

  function handleLinkClick(event) {
    const link = event.target.closest("a");
    if (!link || !event.currentTarget.contains(link)) return;

    const targetView = link.dataset.appView;
    if (targetView) {
      event.preventDefault();
      onNavigate?.(targetView);
      return;
    }

    const href = link.getAttribute("href") || "";
    if (href.endsWith("pages/login.html")) {
      event.preventDefault();
      onSignIn();
    } else if (href.endsWith("pages/signup.html")) {
      event.preventDefault();
      onGetStarted();
    } else if (href === "index.html") {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <div
      className="prototype-landing"
      onClick={handleLinkClick}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
