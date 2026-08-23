import { ReactElement, useState } from "react";
import { Layout } from "./components/Layout";
import { CheckoutPage } from "./pages/CheckoutPage";
import { HomePage } from "./pages/HomePage";
import { InboxPage } from "./pages/InboxPage";
import { InventoryPage } from "./pages/InventoryPage";
import { LogisticsPage } from "./pages/LogisticsPage";
import { MerchantDashboard } from "./pages/MerchantDashboard";
import { AboutPage } from "./pages/AboutPage";
import { ContactPage } from "./pages/ContactPage";
import { AuthPage } from "./pages/AuthPage";

import { isSessionActive, logoutMerchant } from "./lib/api";

export type PageKey = "home" | "dashboard" | "inbox" | "inventory" | "checkout" | "logistics" | "about" | "contact" | "auth";

export function App() {
  const [activePage, setActivePage] = useState<PageKey>("home");

  const protectedPages: PageKey[] = ["dashboard", "inbox", "inventory", "checkout", "logistics"];

  const handleNavigate = async (page: PageKey) => {
    if (protectedPages.includes(page)) {
      const active = await isSessionActive();
      if (!active) {
        setActivePage("auth");
        return;
      }
    }
    setActivePage(page);
  };

  const handleLogout = async () => {
    try {
      await logoutMerchant();
    } catch (error) {
      console.warn("Logout request failed; clearing client session anyway.", error);
    } finally {
      setActivePage("home");
    }
  };

  const pages: Record<PageKey, ReactElement> = {
    home: <HomePage onNavigate={handleNavigate} />,
    dashboard: <MerchantDashboard />,
    inbox: <InboxPage onNavigate={handleNavigate} />,
    inventory: <InventoryPage />,
    checkout: <CheckoutPage />,
    logistics: <LogisticsPage />,
    about: <AboutPage />,
    contact: <ContactPage />,
    auth: <AuthPage onNavigate={handleNavigate} />
  };

  return (
    <Layout activePage={activePage} onNavigate={handleNavigate} onLogout={handleLogout}>
      {pages[activePage]}
    </Layout>
  );
}
