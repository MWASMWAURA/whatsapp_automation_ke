"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  isLoggedIn: boolean;
  sessionActive: boolean;
}

interface UserContextType {
  user: User | null;
  login: (email: string, name: string, phone: string) => void;
  logout: () => void;
  updateProfile: (updates: Partial<User>) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Load user from localStorage on mount
    const savedUser = localStorage.getItem("user");
    const authToken = localStorage.getItem("authToken");

    if (savedUser && authToken) {
      try {
        const parsedUser = JSON.parse(savedUser);
        // Check if session is still active (within 24 hours)
        const sessionAge = Date.now() - (parsedUser.lastLogin || 0);
        if (sessionAge < 24 * 60 * 60 * 1000) {
          // 24 hours
          setUser({ ...parsedUser, sessionActive: true });
        } else {
          localStorage.removeItem("user");
          localStorage.removeItem("authToken");
        }
      } catch (error) {
        console.error("Error loading user:", error);
        localStorage.removeItem("user");
        localStorage.removeItem("authToken");
      }
    }
  }, []);

  const login = (email: string, name: string, phone: string) => {
    const newUser: User = {
      id: Date.now().toString(),
      email,
      name,
      phone,
      isLoggedIn: true,
      sessionActive: true,
    };
    setUser(newUser);
    localStorage.setItem(
      "user",
      JSON.stringify({ ...newUser, lastLogin: Date.now() })
    );
  };

  const logout = async () => {
    try {
      // Call logout API
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      console.error("Logout API error:", error);
    }

    // Clear local state and storage
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("authToken");
  };

  const updateProfile = (updates: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updates };
      setUser(updatedUser);
      localStorage.setItem(
        "user",
        JSON.stringify({ ...updatedUser, lastLogin: Date.now() })
      );
    }
  };

  return (
    <UserContext.Provider value={{ user, login, logout, updateProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
