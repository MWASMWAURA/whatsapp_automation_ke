// Database integration placeholders for Firebase/Supabase
// In production, replace with actual implementations

export interface Contact {
  id: string;
  name: string;
  title: string;
  phone: string;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Reply {
  id: string;
  campaignId: string;
  contactId: string;
  message: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  timestamp: string;
  isAIResponded?: boolean;
  aiResponse?: string;
}

export interface Campaign {
  id: string;
  name: string;
  message: string;
  contacts: string[];
  scheduledAt?: string;
  status: 'draft' | 'scheduled' | 'sending' | 'completed';
  createdAt: string;
  autoreplyEnabled?: boolean;
  replies?: Reply[];
  replyStats?: {
    totalReplies: number;
    positive: number;
    negative: number;
    neutral: number;
  };
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category?: string;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  content: string;
  category: string;
  createdAt: string;
}

// Firebase placeholder
export class FirebaseDB {
  // Initialize Firebase
  // const app = initializeApp(firebaseConfig);
  // const db = getFirestore(app);

  static async getContacts(): Promise<Contact[]> {
    // return getDocs(collection(db, 'contacts'));
    console.log('Firebase: Getting contacts');
    return [];
  }

  static async addContact(contact: Omit<Contact, 'id'>): Promise<Contact> {
    // return addDoc(collection(db, 'contacts'), contact);
    console.log('Firebase: Adding contact', contact);
    return { ...contact, id: Date.now().toString() };
  }

  static async updateContact(id: string, updates: Partial<Contact>): Promise<void> {
    // return updateDoc(doc(db, 'contacts', id), updates);
    console.log('Firebase: Updating contact', id, updates);
  }

  static async deleteContact(id: string): Promise<void> {
    // return deleteDoc(doc(db, 'contacts', id));
    console.log('Firebase: Deleting contact', id);
  }
}

// Supabase placeholder
export class SupabaseDB {
  // Initialize Supabase
  // const supabase = createClient(supabaseUrl, supabaseKey);

  static async getContacts(): Promise<Contact[]> {
    // return supabase.from('contacts').select('*');
    console.log('Supabase: Getting contacts');
    return [];
  }

  static async addContact(contact: Omit<Contact, 'id'>): Promise<Contact> {
    // return supabase.from('contacts').insert(contact).select().single();
    console.log('Supabase: Adding contact', contact);
    return { ...contact, id: Date.now().toString() };
  }

  static async updateContact(id: string, updates: Partial<Contact>): Promise<void> {
    // return supabase.from('contacts').update(updates).eq('id', id);
    console.log('Supabase: Updating contact', id, updates);
  }

  static async deleteContact(id: string): Promise<void> {
    // return supabase.from('contacts').delete().eq('id', id);
    console.log('Supabase: Deleting contact', id);
  }
}

// Choose database implementation
export const db = process.env.DATABASE_TYPE === 'supabase' ? SupabaseDB : FirebaseDB;