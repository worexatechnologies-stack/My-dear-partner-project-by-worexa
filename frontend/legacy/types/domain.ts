export interface Profile {
  id: string; name: string; age: number; height: string; religion: string; caste: string;
  education: string; occupation: string; income: string; location: string; photo: string; photoFull?: string;
  gender?: string; isDemo?: boolean;
  verified: boolean; premium: boolean; compatibility: number; about: string; photoVisibility?: 'visible' | 'pending_approval' | 'unavailable';
  familyType: string; motherTongue: string; maritalStatus: string; hobbies: string[]; partnerPrefs: string;
  chat_public_key?: string;
  access?: any;
  is_unlocked?: boolean;
}

export interface MembershipPlan { id: string; name: string; price: number; duration: string; features: string[]; highlighted: boolean; badge?: string; color: string }
export interface Message { id: string; senderId: string; text: string; time: string; read: boolean }
export interface Conversation { id: string; profile: Profile; lastMessage: string; time: string; unread: number; online: boolean; messages: Message[] }
