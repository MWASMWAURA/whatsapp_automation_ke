import { useState, useEffect } from 'react';

export interface Template {
  id: string;
  name: string;
  content: string;
  category: string;
  createdAt: string;
}

const STORAGE_KEY = 'templates';

const defaultTemplates: Template[] = [
  {
    id: "1",
    name: "Welcome Message",
    content:
      "Hi {{name}}! Welcome to our service. As {{title}}, I'm sure you'll find our solutions valuable.",
    category: "Onboarding",
    createdAt: "2024-01-15",
  },
  {
    id: "2",
    name: "Follow-up",
    content:
      "Hello {{name}}, I wanted to follow up on our previous conversation. How can we assist you today?",
    category: "Sales",
    createdAt: "2024-01-10",
  },
  {
    id: "3",
    name: "Thank You",
    content:
      "Thank you {{name}} for your time. We appreciate your interest in our services.",
    category: "General",
    createdAt: "2024-01-05",
  },
];

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>(defaultTemplates);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setTemplates(JSON.parse(saved));
        } catch (error) {
          console.error('Error loading templates from localStorage:', error);
        }
      }
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    }
  }, [templates, isLoaded]);

  const addTemplate = (template: Omit<Template, 'id' | 'createdAt'>) => {
    const newTemplate: Template = {
      ...template,
      id: Date.now().toString(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    setTemplates(prev => [...prev, newTemplate]);
    return newTemplate;
  };

  const updateTemplate = (id: string, updates: Partial<Template>) => {
    setTemplates(prev =>
      prev.map(t => t.id === id ? { ...t, ...updates } : t)
    );
  };

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  return {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
  };
}