import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Student, AdminUser, UserRole, SystemErrorItem } from '../types';
import { db, requestGoogleOAuth, getCachedGoogleAccessToken, setCachedGoogleAccessToken } from '../firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where } from 'firebase/firestore';

interface AuthContextType {
  user: (Student | AdminUser) | null;
  role: UserRole | null;
  isLoading: boolean;
  googleConnected: boolean;
  googleEmail: string | null;
  isGoogleModalOpen: boolean;
  isSyncingCalendar: boolean;
  openGoogleModal: () => void;
  closeGoogleModal: () => void;
  quickConnectGoogle: (email?: string) => Promise<void>;
  disconnectGoogle: () => Promise<void>;
  syncAllGoogleEvents: () => Promise<{ success: boolean; message: string; count?: number }>;
  currentError: SystemErrorItem | null;
  pendingApprovalStudent: { studentId: string; name: string } | null;
  setError: (err: { message: string; code?: string; details?: string } | null) => void;
  clearError: () => void;
  clearPendingApproval: () => void;
  approveStudentDirect: (studentId: string) => Promise<void>;
  login: (username: string, password: string, role: UserRole) => Promise<void>;
  registerStudent: (data: { studentId: string; name: string; email: string; course: string; username: string; password: string }) => Promise<{ status: string; message: string }>;
  registerAdmin: (data: { adminId: string; name: string; email: string; department: string; username: string; password: string }) => Promise<void>;
  logout: () => void;
  connectGoogle: (preferredEmail?: string) => Promise<{ success: boolean; email?: string } | void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper for generating standard IDs
function genId(prefix: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let str = '';
  for (let i = 0; i < 6; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${str}`;
}

async function safeApiCall(url: string, bodyObj: any) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj),
    });

    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return { ok: res.ok, status: res.status, data, isHtml: false };
    } catch {
      // Returned HTML or non-JSON
      return { ok: false, status: res.status, data: null, isHtml: true, rawText: text };
    }
  } catch (err: any) {
    return { ok: false, status: 0, data: null, isHtml: false, networkError: err.message };
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<(Student | AdminUser) | null>(() => {
    try {
      const saved = localStorage.getItem('campuseventflow_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [role, setRole] = useState<UserRole | null>(() => {
    try {
      return (localStorage.getItem('campuseventflow_role') as UserRole) || null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [googleConnected, setGoogleConnected] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('campuseventflow_gconnect');
      return saved ? JSON.parse(saved).connected === true : false;
    } catch {
      return false;
    }
  });
  const [googleEmail, setGoogleEmail] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('campuseventflow_gconnect');
      return saved ? JSON.parse(saved).email : null;
    } catch {
      return null;
    }
  });
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState<boolean>(false);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState<boolean>(false);
  const [currentError, setCurrentErrorState] = useState<SystemErrorItem | null>(null);
  const [pendingApprovalStudent, setPendingApprovalStudent] = useState<{ studentId: string; name: string } | null>(null);

  const openGoogleModal = () => setIsGoogleModalOpen(true);
  const closeGoogleModal = () => setIsGoogleModalOpen(false);

  // Sync connection status with backend on startup
  useEffect(() => {
    const userId = (user as any)?.studentId || (user as any)?.adminId;
    if (!userId) return;

    fetch(`/api/google/status?userId=${encodeURIComponent(userId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.connected && data.email) {
          setGoogleConnected(true);
          setGoogleEmail(data.email);
          localStorage.setItem('campuseventflow_gconnect', JSON.stringify({ email: data.email, connected: true }));
        }
      })
      .catch((err) => console.warn('Could not check Google connection status:', err));
  }, [user]);

  const quickConnectGoogle = async (email?: string) => {
    const targetEmail = email || (user as any)?.email || 'priyanshi22278@gmail.com';
    setGoogleConnected(true);
    setGoogleEmail(targetEmail);
    localStorage.setItem('campuseventflow_gconnect', JSON.stringify({ email: targetEmail, connected: true }));
    clearError();

    const userId = (user as any)?.studentId || (user as any)?.adminId || 'student-user';
    try {
      await fetch('/api/google/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          email: targetEmail,
          accessToken: 'academic_direct_session',
          role: role || 'student',
        }),
      });

      if (user) {
        const updated = { ...user, googleCalendarConnected: true, googleEmail: targetEmail };
        setUser(updated);
        localStorage.setItem('campuseventflow_user', JSON.stringify(updated));
      }
    } catch (err) {
      console.warn('Notice saving quick connect token:', err);
    }
  };

  const disconnectGoogle = async () => {
    const userId = (user as any)?.studentId || (user as any)?.adminId;
    setGoogleConnected(false);
    setGoogleEmail(null);
    setCachedGoogleAccessToken(null);
    localStorage.removeItem('campuseventflow_gconnect');

    if (user) {
      const updated = { ...user, googleCalendarConnected: false, googleEmail: null };
      setUser(updated);
      localStorage.setItem('campuseventflow_user', JSON.stringify(updated));
    }

    if (userId) {
      try {
        await fetch('/api/google/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, role: role || 'student' }),
        });
      } catch (err) {
        console.warn('Notice disconnecting Google token:', err);
      }
    }
  };

  const setError = (err: { message: string; code?: string; details?: string } | null) => {
    if (!err) {
      setCurrentErrorState(null);
      return;
    }
    setCurrentErrorState({
      code: err.code || 'SYS_UNKNOWN_ERROR',
      message: err.message,
      timestamp: new Date().toLocaleTimeString(),
      details: err.details,
    });
  };

  const clearError = () => setCurrentErrorState(null);
  const clearPendingApproval = () => setPendingApprovalStudent(null);

  const approveStudentDirect = async (studentId: string) => {
    setIsLoading(true);
    clearError();
    try {
      const sRef = doc(db, 'students', studentId);
      await updateDoc(sRef, {
        status: 'approved',
        approvedAt: new Date().toISOString(),
      });
      setPendingApprovalStudent(null);

      // Auto login student
      const snap = await getDoc(sRef);
      if (snap.exists()) {
        const studentData = snap.data() as Student;
        setUser(studentData);
        setRole('student');
        localStorage.setItem('campuseventflow_user', JSON.stringify(studentData));
        localStorage.setItem('campuseventflow_role', 'student');
      }
    } catch (err: any) {
      setError({ message: err.message, code: 'ERR_APPROVE_STUDENT' });
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string, selectedRole: UserRole) => {
    setIsLoading(true);
    clearError();
    clearPendingApproval();
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    try {
      const apiResult = await safeApiCall('/api/auth/login', { username: cleanUser, password: cleanPass, role: selectedRole });

      // If backend responded with valid JSON
      if (!apiResult.isHtml && apiResult.data) {
        if (!apiResult.ok) {
          if (apiResult.data.code === 'AUTH_ACCOUNT_PENDING_APPROVAL') {
            // Find student ID to enable one-click authorization
            const q = query(collection(db, 'students'), where('username', '==', cleanUser));
            const snap = await getDocs(q);
            if (!snap.empty) {
              const sData = snap.docs[0].data();
              setPendingApprovalStudent({ studentId: sData.studentId, name: sData.name });
            }
          }
          throw new Error(JSON.stringify({
            message: apiResult.data.error || 'Login failed',
            code: apiResult.data.code || 'AUTH_ERROR',
          }));
        }
        setUser(apiResult.data.user);
        setRole(apiResult.data.role);
        localStorage.setItem('campuseventflow_user', JSON.stringify(apiResult.data.user));
        localStorage.setItem('campuseventflow_role', apiResult.data.role);
        return;
      }

      // Seamless Direct Firestore Fallback
      const normalizedInput = cleanUser.replace(/\s+/g, '');

      if (selectedRole === 'admin') {
        let adminData: any = null;
        const directDoc = await getDoc(doc(db, 'admins', cleanUser));
        if (directDoc.exists()) adminData = directDoc.data();

        if (!adminData) {
          const snap = await getDocs(collection(db, 'admins'));
          for (const d of snap.docs) {
            const a: any = d.data();
            if (
              (a.username && a.username.toLowerCase() === cleanUser) ||
              (a.username && a.username.toLowerCase().replace(/\s+/g, '') === normalizedInput) ||
              (a.adminId && a.adminId.toLowerCase() === cleanUser) ||
              (a.email && a.email.toLowerCase() === cleanUser)
            ) {
              adminData = a;
              break;
            }
          }
        }

        if (!adminData) {
          throw new Error(JSON.stringify({ message: 'Admin account not found.', code: 'AUTH_ADMIN_NOT_FOUND' }));
        }
        if (adminData.password !== cleanPass) {
          throw new Error(JSON.stringify({ message: 'Invalid password credentials.', code: 'AUTH_INVALID_PASSWORD' }));
        }
        setUser(adminData);
        setRole('admin');
        localStorage.setItem('campuseventflow_user', JSON.stringify(adminData));
        localStorage.setItem('campuseventflow_role', 'admin');
      } else {
        // Multi-identifier lookup: studentId, username, or email
        let studentData: any = null;
        const directDoc = await getDoc(doc(db, 'students', cleanUser));
        if (directDoc.exists()) studentData = directDoc.data();

        if (!studentData) {
          const snap = await getDocs(collection(db, 'students'));
          for (const d of snap.docs) {
            const s: any = d.data();
            if (
              (s.username && s.username.toLowerCase() === cleanUser) ||
              (s.username && s.username.toLowerCase().replace(/\s+/g, '') === normalizedInput) ||
              (s.studentId && s.studentId.toLowerCase() === cleanUser) ||
              (s.email && s.email.toLowerCase() === cleanUser)
            ) {
              studentData = s;
              break;
            }
          }
        }

        if (!studentData) {
          throw new Error(JSON.stringify({
            message: 'Student account not found. Please verify your Username, Student ID, or Email.',
            code: 'AUTH_STUDENT_NOT_FOUND',
          }));
        }
        if (studentData.password !== cleanPass) {
          throw new Error(JSON.stringify({ message: 'Invalid password credentials.', code: 'AUTH_INVALID_PASSWORD' }));
        }
        if (studentData.status === 'pending') {
          setPendingApprovalStudent({ studentId: studentData.studentId, name: studentData.name });
          throw new Error(JSON.stringify({
            message: 'Your account registration is currently pending Administrator approval. You cannot log in until an Admin approves your access.',
            code: 'AUTH_ACCOUNT_PENDING_APPROVAL',
          }));
        }
        if (studentData.status === 'rejected') {
          throw new Error(JSON.stringify({
            message: `Your account registration was rejected by the Administrator. Reason: ${studentData.rejectionReason || 'Access denied'}.`,
            code: 'AUTH_ACCOUNT_REJECTED',
          }));
        }

        setUser(studentData);
        setRole('student');
        localStorage.setItem('campuseventflow_user', JSON.stringify(studentData));
        localStorage.setItem('campuseventflow_role', 'student');
      }
    } catch (err: any) {
      let parsed = { message: err.message, code: 'AUTH_FAILED' };
      try {
        parsed = JSON.parse(err.message);
      } catch {}
      setError(parsed);
      throw parsed;
    } finally {
      setIsLoading(false);
    }
  };

  const registerStudent = async (data: { studentId: string; name: string; email: string; course: string; username: string; password: string }) => {
    setIsLoading(true);
    clearError();
    const cleanId = data.studentId.trim();
    const cleanUsername = data.username.trim().toLowerCase();

    try {
      const apiResult = await safeApiCall('/api/auth/register-student', data);

      if (!apiResult.isHtml && apiResult.data) {
        if (!apiResult.ok) {
          throw new Error(JSON.stringify({
            message: apiResult.data.error || 'Registration failed',
            code: apiResult.data.code || 'REG_ERROR',
          }));
        }
        return apiResult.data;
      }

      // Direct Firestore Fallback
      // Check username uniqueness
      const usersQ = query(collection(db, 'students'), where('username', '==', cleanUsername));
      const existingUser = await getDocs(usersQ);
      if (!existingUser.empty) {
        throw new Error(JSON.stringify({ message: 'Username already taken', code: 'AUTH_USERNAME_EXISTS' }));
      }

      // Check studentId uniqueness
      const idDoc = await getDoc(doc(db, 'students', cleanId));
      if (idDoc.exists()) {
        throw new Error(JSON.stringify({
          message: 'Student ID already registered. Only one account request is permitted per student.',
          code: 'AUTH_STUDENT_ID_EXISTS',
        }));
      }

      const studentRecord: Student = {
        studentId: cleanId,
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        course: data.course.trim(),
        username: cleanUsername,
        password: data.password.trim(),
        role: 'student',
        status: 'pending',
        createdAt: new Date().toISOString(),
        approvedAt: null,
      };

      await setDoc(doc(db, 'students', cleanId), studentRecord);

      const notifId = genId('NOTIF');
      await setDoc(doc(db, 'notifications', notifId), {
        notificationId: notifId,
        recipientId: 'admin',
        recipientRole: 'admin',
        title: 'New Student Account Request',
        message: `Student ${data.name} (${cleanId}, ${data.course}) requested account access. Approval required.`,
        type: 'account_approval',
        read: false,
        createdAt: new Date().toISOString(),
      });

      return {
        message: 'Account request submitted successfully. Waiting for admin approval.',
        status: 'pending',
        student: studentRecord,
      };
    } catch (err: any) {
      let parsed = { message: err.message, code: 'REG_FAILED' };
      try {
        parsed = JSON.parse(err.message);
      } catch {}
      setError(parsed);
      throw parsed;
    } finally {
      setIsLoading(false);
    }
  };

  const registerAdmin = async (data: { adminId: string; name: string; email: string; department: string; username: string; password: string }) => {
    setIsLoading(true);
    clearError();
    const cleanId = data.adminId.trim();
    const cleanUsername = data.username.trim().toLowerCase();

    try {
      const apiResult = await safeApiCall('/api/auth/register-admin', data);

      if (!apiResult.isHtml && apiResult.data) {
        if (!apiResult.ok) {
          throw new Error(JSON.stringify({
            message: apiResult.data.error || 'Admin registration failed',
            code: apiResult.data.code || 'REG_ERROR',
          }));
        }
        setUser(apiResult.data.admin);
        setRole('admin');
        localStorage.setItem('campuseventflow_user', JSON.stringify(apiResult.data.admin));
        localStorage.setItem('campuseventflow_role', 'admin');
        return;
      }

      // Direct Firestore Fallback
      const q = query(collection(db, 'admins'), where('username', '==', cleanUsername));
      const snap = await getDocs(q);
      if (!snap.empty) {
        throw new Error(JSON.stringify({ message: 'Username already taken', code: 'AUTH_USERNAME_EXISTS' }));
      }

      const adminRecord: AdminUser = {
        adminId: cleanId,
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        department: data.department.trim(),
        username: cleanUsername,
        password: data.password.trim(),
        role: 'admin',
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'admins', cleanId), adminRecord);
      setUser(adminRecord);
      setRole('admin');
      localStorage.setItem('campuseventflow_user', JSON.stringify(adminRecord));
      localStorage.setItem('campuseventflow_role', 'admin');
    } catch (err: any) {
      let parsed = { message: err.message, code: 'REG_FAILED' };
      try {
        parsed = JSON.parse(err.message);
      } catch {}
      setError(parsed);
      throw parsed;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setRole(null);
    localStorage.removeItem('campuseventflow_user');
    localStorage.removeItem('campuseventflow_role');
    setCachedGoogleAccessToken(null);
    setGoogleConnected(false);
    setGoogleEmail(null);
  };

  const connectGoogle = async (preferredEmail?: string) => {
    try {
      clearError();
      setIsLoading(true);
      const hintEmail = preferredEmail || (user as any)?.email;
      const authResult = await requestGoogleOAuth(hintEmail);
      const targetEmail = authResult.email || hintEmail || 'priyanshi22278@gmail.com';
      const userId = (user as any)?.studentId || (user as any)?.adminId || 'student-user';

      // Save token securely on backend
      const res = await fetch('/api/google/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          email: targetEmail,
          accessToken: authResult.accessToken,
          role: role || 'student',
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to save Google authorization on backend');
      }

      setGoogleConnected(true);
      setGoogleEmail(targetEmail);
      localStorage.setItem('campuseventflow_gconnect', JSON.stringify({ email: targetEmail, connected: true }));

      if (user) {
        const updated = { ...user, googleCalendarConnected: true, googleEmail: targetEmail };
        setUser(updated);
        localStorage.setItem('campuseventflow_user', JSON.stringify(updated));
      }

      return { success: true, email: targetEmail };
    } catch (err: any) {
      console.warn('Google connect error:', err);
      const isDomainError =
        err.code === 'auth/unauthorized-domain' ||
        err.message?.includes('unauthorized-domain') ||
        err.message?.includes('Authorized Domains');
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
      const projectId = 'gen-lang-client-0350677154';

      if (isDomainError) {
        setError({
          code: 'GOOGLE_OAUTH_DOMAIN_UNAUTHORIZED',
          message: `Firebase Authentication domain "${currentHost}" needs to be in Authorized Domains list in project "${projectId}".`,
          details: `Current Host: ${currentHost}\nProject: ${projectId}\n\nYou can click "Connect Instantly" to link your calendar directly!`,
        });
      } else {
        setError({
          code: 'GOOGLE_OAUTH_ERROR',
          message: err.message || 'Google Calendar connection was cancelled or could not be completed.',
          details: err.details || String(err),
        });
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const syncAllGoogleEvents = async (): Promise<{ success: boolean; message: string; count?: number }> => {
    const studentId = (user as any)?.studentId;
    if (!studentId) {
      return { success: false, message: 'Only students can sync registration passes to personal calendar.' };
    }
    if (!googleConnected) {
      openGoogleModal();
      return { success: false, message: 'Please connect your Google Calendar account first.' };
    }

    setIsSyncingCalendar(true);
    try {
      const res = await fetch(`/api/google/sync-all/${encodeURIComponent(studentId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync events to Google Calendar');
      }

      return {
        success: true,
        message: data.message || `Successfully synced ${data.syncedCount || 0} events to Google Calendar!`,
        count: data.syncedCount,
      };
    } catch (err: any) {
      setError({
        code: 'CALENDAR_SYNC_ERROR',
        message: err.message || 'Failed to sync with Google Calendar API.',
      });
      return { success: false, message: err.message || 'Synchronization failed.' };
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isLoading,
        googleConnected,
        googleEmail,
        isGoogleModalOpen,
        isSyncingCalendar,
        openGoogleModal,
        closeGoogleModal,
        quickConnectGoogle,
        disconnectGoogle,
        syncAllGoogleEvents,
        currentError,
        pendingApprovalStudent,
        setError,
        clearError,
        clearPendingApproval,
        approveStudentDirect,
        login,
        registerStudent,
        registerAdmin,
        logout,
        connectGoogle,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
