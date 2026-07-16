"use client";

import { useState, useEffect, FormEvent, useMemo } from "react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  Timestamp,
  where
} from "firebase/firestore";
import { BIBLE_BOOKS } from "@/lib/bible";
import { useLanguage } from "@/lib/i18n";

type DiscussionGroup = {
  id: string;
  name: string;
  description: string;
  icon: string;
  creatorId?: string;
};

type DiscussionPost = {
  id: string;
  authorId: string;
  authorName: string;
  verseRef?: string;
  content: string;
  createdAt?: Timestamp;
};

type PostComment = {
  id: string;
  authorName: string;
  content: string;
  createdAt?: Timestamp;
};

type GroupMember = {
  id: string;
  name: string;
  email?: string;
  joinedAt?: Timestamp;
  addedByAdmin?: boolean;
  isPending?: boolean;
};

export default function DevotionGroupPage() {
  const { t, language } = useLanguage();

  const defaultGroups: DiscussionGroup[] = useMemo(() => {
    return [
      { 
        id: "pemuda", 
        name: language === "zh" ? "青年与学生小组" : language === "en" ? "Youth & Student Group" : "Grup Pemuda & Mahasiswa", 
        description: language === "zh" ? "讨论关于基督徒青年的信仰、职业、社交和挑战。" : language === "en" ? "Discussion about faith, career, social life, and challenges of Christian youth." : "Diskusi tentang iman, karir, pergaulan, dan tantangan anak muda Kristen.", 
        icon: "🙌" 
      },
      { 
        id: "roma", 
        name: language === "zh" ? "罗马书研读" : language === "en" ? "Romans Book Study" : "Studi Kitab Roma", 
        description: language === "zh" ? "探讨保罗关于因信称义和在圣灵里新生活的联合神学。" : language === "en" ? "Digging into Paul's theology of justification by faith and new life in the Spirit." : "Menggali teologi Paulus tentang pembenaran oleh iman dan kehidupan baru dalam Roh.", 
        icon: "📖" 
      },
      { 
        id: "keluarga", 
        name: language === "zh" ? "家庭与婚姻" : language === "en" ? "Family & Marriage" : "Keluarga & Pernikahan", 
        description: language === "zh" ? "在家庭生活和抚养孩子中应用圣经原则。" : language === "en" ? "Applying biblical principles in marriage life and child parenting." : "Menerapkan prinsip alkitabiah dalam kehidupan rumah tangga dan mendidik anak.", 
        icon: "🏡" 
      },
      { 
        id: "doa", 
        name: language === "zh" ? "祷告与家庭祭坛" : language === "en" ? "Prayer & Family Altar" : "Doa & Mezbah Keluarga", 
        description: language === "zh" ? "分享祷告事项、祷告蒙应允的见证以及每日灵修。" : language === "en" ? "Sharing prayer requests, answered prayer testimonies, and daily quiet time." : "Saling membagikan pokok doa, kesaksian jawaban doa, dan saat teduh harian.", 
        icon: "🙏" 
      },
    ];
  }, [language]);

  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState("Anggota");
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);

  // Group states
  const [groups, setGroups] = useState<DiscussionGroup[]>(defaultGroups);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<DiscussionGroup | null>(null);
  
  // Post/Comment states
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [postVerseRef, setPostVerseRef] = useState("");
  const [submittingPost, setSubmittingPost] = useState(false);

  // Bible link builder dropdown states
  const [linkBook, setLinkBook] = useState("");
  const [linkChapter, setLinkChapter] = useState(1);
  const [linkVerseStart, setLinkVerseStart] = useState("");
  const [linkVerseEnd, setLinkVerseEnd] = useState("");

  // Comment Modal states
  const [expandedPost, setExpandedPost] = useState<DiscussionPost | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Member states
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [manualMemberEmail, setManualMemberEmail] = useState("");
  const [submittingMember, setSubmittingMember] = useState(false);

  // Admin Group Creation states
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [newGroupIcon, setNewGroupIcon] = useState("📖");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [showCreateGroupForm, setShowCreateGroupForm] = useState(false);

  // Admin Group Editing states
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupDesc, setEditGroupDesc] = useState("");
  const [editGroupIcon, setEditGroupIcon] = useState("📖");
  const [updatingGroup, setUpdatingGroup] = useState(false);

  const canManage = isAdminUser || (selectedGroup && selectedGroup.creatorId === user?.uid);

  // Sync groups state with defaultGroups when defaultGroups updates
  useEffect(() => {
    setGroups(defaultGroups);
  }, [defaultGroups]);

  // Auth observer
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setUserName(currentUser.displayName || currentUser.email?.split("@")[0] || "Anggota");
        if (db) {
          try {
            const userDoc = await getDoc(doc(db, "users", currentUser.uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              if (data.name) setUserName(data.name);
              if (data.role === "admin") {
                setIsAdminUser(true);
              }
            }
          } catch (e) {}
        }
      } else {
        setIsAdminUser(false);
      }
      setLoading(false);
    });
  }, []);

  // Fetch groups dynamically
  async function fetchGroups() {
    if (!db) return;
    setLoadingGroups(true);
    try {
      const snap = await getDocs(collection(db, "devotion_groups"));
      if (!snap.empty) {
        const loadedGroups = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DiscussionGroup));
        setGroups(loadedGroups);
      } else {
        setGroups(defaultGroups);
      }
    } catch (e) {
      console.error("Gagal mengambil grup dari Firestore:", e);
      setGroups(defaultGroups);
    } finally {
      setLoadingGroups(false);
    }
  }

  useEffect(() => {
    fetchGroups();
  }, [user]);

  // Fetch posts and members when selectedGroup changes
  useEffect(() => {
    if (selectedGroup) {
      fetchGroupPosts(selectedGroup.id);
      fetchGroupMembers(selectedGroup.id);
      setIsEditingGroup(false);
    } else {
      setPosts([]);
      setMembers([]);
      setIsJoined(false);
      setIsEditingGroup(false);
    }
  }, [selectedGroup, user]);

  // Fetch comments when expanded post changes
  useEffect(() => {
    if (expandedPost && selectedGroup) {
      fetchPostComments(selectedGroup.id, expandedPost.id);
    } else {
      setComments([]);
    }
  }, [expandedPost, selectedGroup]);

  // Compile Bible Link from dropdowns
  useEffect(() => {
    if (linkBook) {
      let ref = `${linkBook} ${linkChapter}`;
      if (linkVerseStart) {
        ref += `:${linkVerseStart}`;
        if (linkVerseEnd && Number(linkVerseEnd) > Number(linkVerseStart)) {
          ref += `-${linkVerseEnd}`;
        }
      }
      setPostVerseRef(ref);
    } else {
      setPostVerseRef("");
    }
  }, [linkBook, linkChapter, linkVerseStart, linkVerseEnd]);

  async function fetchGroupPosts(groupId: string) {
    if (!db) return;
    setLoadingPosts(true);
    try {
      const postsCol = collection(db, "devotion_groups", groupId, "posts");
      const q = query(postsCol, orderBy("createdAt", "desc"), limit(50));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DiscussionPost));
      setPosts(data);
    } catch (e) {
      console.error("Gagal mengambil postingan:", e);
    } finally {
      setLoadingPosts(false);
    }
  }

  async function fetchGroupMembers(groupId: string) {
    if (!db) return;
    setLoadingMembers(true);
    try {
      const snap = await getDocs(collection(db, "devotion_groups", groupId, "members"));
      const loadedMembers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GroupMember));
      setMembers(loadedMembers);
      
      if (user) {
        setIsJoined(loadedMembers.some(m => m.id === user.uid));
      } else {
        setIsJoined(false);
      }
    } catch (e) {
      console.error("Gagal mengambil anggota grup:", e);
    } finally {
      setLoadingMembers(false);
    }
  }

  async function fetchPostComments(groupId: string, postId: string) {
    if (!db) return;
    setLoadingComments(true);
    try {
      const commentsCol = collection(db, "devotion_groups", groupId, "posts", postId, "comments");
      const q = query(commentsCol, orderBy("createdAt", "asc"), limit(100));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PostComment));
      setComments(data);
    } catch (e) {
      console.error("Gagal mengambil komentar:", e);
    } finally {
      setLoadingComments(false);
    }
  }

  async function handleJoinGroup() {
    if (!user || !db || !selectedGroup) return;
    try {
      await setDoc(doc(db, "devotion_groups", selectedGroup.id, "members", user.uid), {
        name: userName,
        email: user.email || "",
        joinedAt: serverTimestamp(),
      });
      setIsJoined(true);
      fetchGroupMembers(selectedGroup.id);
    } catch (e) {
      alert(t("grup_renungan.alert_join_fail"));
    }
  }

  async function handleLeaveGroup() {
    if (!user || !db || !selectedGroup) return;
    try {
      await deleteDoc(doc(db, "devotion_groups", selectedGroup.id, "members", user.uid));
      setIsJoined(false);
      fetchGroupMembers(selectedGroup.id);
    } catch (e) {
      alert(t("grup_renungan.alert_leave_fail"));
    }
  }

  async function handleAddMemberEmail(e: FormEvent) {
    e.preventDefault();
    const emailInput = manualMemberEmail.trim().toLowerCase();
    if (!user || !db || !selectedGroup || !emailInput || submittingMember) return;

    setSubmittingMember(true);
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", emailInput), limit(1));
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        const userDoc = querySnap.docs[0];
        const userData = userDoc.data();
        await setDoc(doc(db, "devotion_groups", selectedGroup.id, "members", userDoc.id), {
          name: userData.name || userData.email.split("@")[0],
          email: userData.email,
          joinedAt: serverTimestamp(),
        });
        alert(language === "zh" ? `成功将 ${userData.name || emailInput} 添加到小组。` : language === "en" ? `Successfully registered ${userData.name || emailInput} into the group.` : `Berhasil mendaftarkan ${userData.name || emailInput} ke dalam grup.`);
      } else {
        const invRef = doc(collection(db, "devotion_groups", selectedGroup.id, "members"));
        await setDoc(invRef, {
          name: emailInput,
          email: emailInput,
          addedByAdmin: true,
          isPending: true,
          joinedAt: serverTimestamp(),
        });
        alert(language === "zh" ? `邮箱 ${emailInput} 尚未在 Grace Daily 注册。已添加为邀请。` : language === "en" ? `Email ${emailInput} is not registered in Grace Daily yet. Added as invitation.` : `Email ${emailInput} belum terdaftar di Grace Daily. Ditambahkan sebagai undangan.`);
      }
      setManualMemberEmail("");
      fetchGroupMembers(selectedGroup.id);
    } catch (e) {
      console.error("Gagal menambahkan anggota:", e);
      alert(language === "zh" ? "添加成员失败。请重试。" : language === "en" ? "Failed to add member. Please try again." : "Gagal menambahkan anggota. Silakan coba lagi.");
    } finally {
      setSubmittingMember(false);
    }
  }

  async function handleCreateGroup(e: FormEvent) {
    e.preventDefault();
    if (!user || !db || !newGroupName.trim() || creatingGroup) return;

    setCreatingGroup(true);
    try {
      const newGroupId = newGroupName.toLowerCase().replace(/[^a-z0-9]/g, "-");
      await setDoc(doc(db, "devotion_groups", newGroupId), {
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        icon: newGroupIcon.trim(),
        creatorId: user.uid,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "devotion_groups", newGroupId, "members", user.uid), {
        name: userName,
        joinedAt: serverTimestamp(),
      });
      setNewGroupName("");
      setNewGroupDesc("");
      setNewGroupIcon("📖");
      setShowCreateGroupForm(false);
      fetchGroups();
    } catch (e) {
      alert(t("grup_renungan.alert_create_fail"));
    } finally {
      setCreatingGroup(false);
    }
  }

  async function handleUpdateGroup(e: FormEvent) {
    e.preventDefault();
    if (!user || !db || !selectedGroup || !editGroupName.trim() || updatingGroup) return;

    setUpdatingGroup(true);
    try {
      await setDoc(doc(db, "devotion_groups", selectedGroup.id), {
        name: editGroupName.trim(),
        description: editGroupDesc.trim(),
        icon: editGroupIcon.trim(),
      }, { merge: true });

      const updatedGroup = {
        ...selectedGroup,
        name: editGroupName.trim(),
        description: editGroupDesc.trim(),
        icon: editGroupIcon.trim(),
      };
      
      setSelectedGroup(updatedGroup);
      setIsEditingGroup(false);
      fetchGroups();
    } catch (e) {
      alert(t("grup_renungan.alert_update_fail"));
    } finally {
      setUpdatingGroup(false);
    }
  }

  async function handleDeleteGroup() {
    if (!user || !db || !selectedGroup) return;
    if (!confirm(t("grup_renungan.alert_delete_confirm").replace("{}", selectedGroup.name))) return;

    try {
      await deleteDoc(doc(db, "devotion_groups", selectedGroup.id));
      setSelectedGroup(null);
      fetchGroups();
    } catch (e) {
      alert(t("grup_renungan.alert_delete_fail"));
    }
  }

  function startEditingGroup() {
    if (!selectedGroup) return;
    setEditGroupName(selectedGroup.name);
    setEditGroupDesc(selectedGroup.description);
    setEditGroupIcon(selectedGroup.icon);
    setIsEditingGroup(true);
  }

  async function handleCreatePost(e: FormEvent) {
    e.preventDefault();
    if (!user || !db || !selectedGroup || !postContent.trim() || submittingPost) return;

    setSubmittingPost(true);
    try {
      const newPostData = {
        authorId: user.uid,
        authorName: userName,
        content: postContent,
        verseRef: postVerseRef.trim() || null,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, "devotion_groups", selectedGroup.id, "posts"),
        newPostData
      );

      await addDoc(collection(db, "users", user.uid, "activities"), {
        type: "discussion_post",
        title: `Diskusi di ${selectedGroup.name}`,
        description: postContent.slice(0, 160),
        createdAt: serverTimestamp(),
      });

      fetch("/api/groups/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: selectedGroup.id,
          type: "post",
          authorName: userName,
          content: postContent,
          verseRef: postVerseRef.trim() || null,
        }),
      }).catch((err) => console.error("Gagal mengirim notifikasi email diskusi:", err));

      const newPost: DiscussionPost = {
        id: docRef.id,
        authorId: user.uid,
        authorName: userName,
        content: postContent,
        verseRef: postVerseRef.trim() || undefined,
        createdAt: Timestamp.now(),
      };

      setPosts([newPost, ...posts]);
      setPostContent("");
      setLinkBook("");
      setLinkChapter(1);
      setLinkVerseStart("");
      setLinkVerseEnd("");
    } catch (e) {
      alert(t("grup_renungan.alert_post_fail"));
    } finally {
      setSubmittingPost(false);
    }
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!user || !db || !selectedGroup || !expandedPost || !newComment.trim() || submittingComment) return;

    setSubmittingComment(true);
    try {
      const commentData = {
        authorName: userName,
        content: newComment,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, "devotion_groups", selectedGroup.id, "posts", expandedPost.id, "comments"),
        commentData
      );

      fetch("/api/groups/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: selectedGroup.id,
          type: "comment",
          authorName: userName,
          content: newComment,
          postId: expandedPost.id,
          postContent: expandedPost.content,
        }),
      }).catch((err) => console.error("Gagal mengirim notifikasi email komentar:", err));

      const comment: PostComment = {
        id: docRef.id,
        authorName: userName,
        content: newComment,
        createdAt: Timestamp.now(),
      };

      setComments([...comments, comment]);
      setNewComment("");
    } catch (e) {
      alert(t("grup_renungan.alert_comment_fail"));
    } finally {
      setSubmittingComment(false);
    }
  }

  function handleShareDiscussion(post: DiscussionPost, groupName: string) {
    const textToShare = `[Grup Renungan: ${groupName}]\nDiskusi oleh *${post.authorName}*:\n\n"${post.content}"\n${post.verseRef ? `(Ayat: ${post.verseRef})` : ""}\n\nGabung diskusi lengkap di Grace Daily!`;
    const url = `https://wa.me/?text=${encodeURIComponent(textToShare)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function formatTime(timestamp?: Timestamp) {
    if (!timestamp) return language === "zh" ? "刚刚" : language === "en" ? "Just now" : "Baru saja";
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : language === "en" ? "en-US" : "id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  return (
    <main className="min-h-screen bg-[#f7f4ee] px-5 py-6 text-[#1f2933] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col justify-between gap-4 border-b border-[#dfd8ca] pb-6 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#2a6f6f]">
              {t("grup_renungan.page_label")}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[#14213d]">
              {t("grup_renungan.title")}
            </h1>
            <p className="mt-2 text-[#52606d]">
              {t("grup_renungan.subtitle")}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-md bg-[#14213d] px-4 py-2 text-center font-semibold text-white transition hover:bg-[#1a2d52] self-start"
          >
            {t("grup_renungan.back_home")}
          </Link>
        </header>

        {loading ? (
          <p className="text-center py-12 text-[#52606d]">{t("grup_renungan.loading")}</p>
        ) : !user ? (
          <div className="mt-12 rounded-lg border border-[#dfd8ca] bg-white p-12 text-center shadow-md max-w-xl mx-auto">
            <span className="text-5xl mb-4 block">👥</span>
            <h2 className="text-2xl font-bold text-[#14213d] mb-4">{t("grup_renungan.login_title")}</h2>
            <p className="text-[#52606d] mb-8">
              {t("grup_renungan.login_desc")}
            </p>
            <Link
              href="/login"
              className="rounded-md bg-[#2a6f6f] px-8 py-3.5 font-semibold text-white inline-block shadow hover:bg-[#1a4a4a] transition"
            >
              {t("grup_renungan.login_btn")}
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[240px_1fr_280px] items-start">
            {/* Left Sidebar: Groups List */}
            <aside className="flex flex-col gap-4">
              <div className="rounded-lg border border-[#dfd8ca] bg-white p-4 shadow-sm flex flex-col gap-2">
                <h2 className="text-xs font-bold uppercase tracking-widest text-[#2a6f6f] mb-2 px-2">{t("grup_renungan.groups_list")}</h2>
                {groups.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => {
                      setSelectedGroup(group);
                      setExpandedPost(null);
                    }}
                    className={`w-full text-left rounded-md px-3 py-2 text-sm font-semibold transition flex items-center gap-3 cursor-pointer ${
                      selectedGroup?.id === group.id
                        ? "bg-[#2a6f6f] text-white font-bold"
                        : "text-[#334155] hover:bg-[#f7f4ee]"
                    }`}
                  >
                    <span className="text-lg">{group.icon}</span>
                    <span className="truncate">{group.name}</span>
                  </button>
                ))}
              </div>

              {/* Panel: Create Group */}
              {user && (
                <div className="rounded-lg border border-[#dfd8ca] bg-white p-4 shadow-sm">
                  <button
                    onClick={() => setShowCreateGroupForm(!showCreateGroupForm)}
                    className="w-full rounded bg-[#2a6f6f] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#1a4a4a] cursor-pointer"
                  >
                    {showCreateGroupForm ? t("grup_renungan.close_form") : t("grup_renungan.create_group")}
                  </button>

                  {showCreateGroupForm && (
                    <form onSubmit={handleCreateGroup} className="mt-4 grid gap-3 text-xs border-t border-[#dfd8ca] pt-3">
                      <label className="grid gap-1">
                        <span className="font-semibold text-gray-700">{t("grup_renungan.group_name")}</span>
                        <input
                          type="text"
                          required
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          placeholder={language === "zh" ? "例如：基要门徒培训" : language === "en" ? "e.g.: Basic Discipleship" : "Contoh: Pemuridan Dasar"}
                          className="rounded border border-[#dfd8ca] bg-white px-2 py-1.5 outline-none text-[#1f2933]"
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="font-semibold text-gray-700">{t("grup_renungan.description")}</span>
                        <textarea
                          required
                          value={newGroupDesc}
                          onChange={(e) => setNewGroupDesc(e.target.value)}
                          placeholder={language === "zh" ? "学习门徒培训的基本原则..." : language === "en" ? "Studying the basic principles of discipleship..." : "Mempelajari pemuridan dasar..."}
                          className="rounded border border-[#dfd8ca] bg-white px-2 py-1.5 outline-none text-[#1f2933] min-h-[60px]"
                        />
                      </label>
                      <label className="grid gap-1">
                        <span className="font-semibold text-gray-700">{t("grup_renungan.icon_emoji")}</span>
                        <input
                          type="text"
                          required
                          value={newGroupIcon}
                          onChange={(e) => setNewGroupIcon(e.target.value)}
                          placeholder="📖"
                          className="rounded border border-[#dfd8ca] bg-white px-2 py-1.5 outline-none text-[#1f2933] w-12 text-center"
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={creatingGroup}
                        className="rounded bg-[#14213d] px-3 py-2 font-bold text-white transition hover:bg-[#2a6f6f] disabled:opacity-50 mt-1 cursor-pointer"
                      >
                        {creatingGroup ? t("grup_renungan.creating") : t("grup_renungan.create_btn")}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </aside>

            {/* Middle Column: Post feed */}
            <section className="min-h-[500px]">
              {!selectedGroup ? (
                <div className="rounded-lg border-2 border-dashed border-[#dfd8ca] bg-white/50 p-12 text-center flex flex-col items-center justify-center h-full">
                  <span className="text-6xl mb-4">👈</span>
                  <h3 className="text-xl font-bold text-[#14213d] mb-2">{t("grup_renungan.select_group")}</h3>
                  <p className="text-[#52606d] max-w-md">
                    {t("grup_renungan.select_group_desc")}
                  </p>
                </div>
              ) : (
                <div className="grid gap-6 animate-in fade-in">
                  {/* Group Info for mobile (hidden on desktop right side) */}
                  <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm lg:hidden">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{selectedGroup.icon}</span>
                        <h2 className="text-xl font-bold text-[#14213d]">{selectedGroup.name}</h2>
                      </div>
                      
                      {/* Admin/Creator edit/delete buttons for mobile */}
                      {canManage && (
                        <div className="flex gap-2">
                          <button
                            onClick={startEditingGroup}
                            className="rounded bg-gray-100 p-1.5 text-xs text-gray-700 hover:bg-gray-200"
                            title="Edit Grup"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={handleDeleteGroup}
                            className="rounded bg-red-50 p-1.5 text-xs text-red-600 hover:bg-red-100"
                            title="Hapus Grup"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                    
                    {/* Editing Form */}
                    {isEditingGroup && (
                      <form onSubmit={handleUpdateGroup} className="mb-4 grid gap-3 p-4 rounded-lg bg-[#f7f4ee] border border-[#dfd8ca] text-xs">
                        <div className="font-bold text-[#14213d]">{t("grup_renungan.edit_group")}</div>
                        <input
                          type="text"
                          required
                          value={editGroupName}
                          onChange={(e) => setEditGroupName(e.target.value)}
                          className="rounded border border-[#dfd8ca] bg-white px-2 py-1 outline-none"
                        />
                        <textarea
                          required
                          value={editGroupDesc}
                          onChange={(e) => setEditGroupDesc(e.target.value)}
                          className="rounded border border-[#dfd8ca] bg-white px-2 py-1 outline-none min-h-[40px]"
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setIsEditingGroup(false)}
                            className="rounded border border-gray-300 px-3 py-1 bg-white hover:bg-gray-100"
                          >
                            {t("grup_renungan.cancel")}
                          </button>
                          <button
                            type="submit"
                            disabled={updatingGroup}
                            className="rounded bg-[#2a6f6f] px-3 py-1 text-white hover:bg-[#1a4a4a]"
                          >
                            {updatingGroup ? t("grup_renungan.saving") : t("grup_renungan.save")}
                          </button>
                        </div>
                      </form>
                    )}

                    <p className="text-sm text-[#52606d] mb-4">{selectedGroup.description}</p>
                    
                    {/* Join/Leave button mobile */}
                    <button
                      onClick={isJoined ? handleLeaveGroup : handleJoinGroup}
                      className={`w-full rounded px-4 py-2 text-sm font-semibold transition cursor-pointer ${
                        isJoined 
                          ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100" 
                          : "bg-[#2a6f6f] text-white hover:bg-[#1a4a4a]"
                      }`}
                    >
                      {isJoined ? t("grup_renungan.leave") : t("grup_renungan.join")}
                    </button>
                  </div>

                  {/* Add Post Form */}
                  <form onSubmit={handleCreatePost} className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm grid gap-4">
                    <h3 className="text-lg font-semibold text-[#14213d]">{t("grup_renungan.share_reflection")}</h3>
                    
                    {/* Bible reference builder dropdowns */}
                    <div className="grid gap-3 p-4 rounded-lg bg-[#f7f4ee] border border-[#dfd8ca] text-xs">
                      <div className="font-semibold text-[#14213d] mb-1">{t("grup_renungan.bible_link")}</div>
                      <div className="flex gap-2 flex-wrap items-center">
                        <select
                          className="cursor-pointer rounded border border-[#dfd8ca] bg-white px-2.5 py-1.5 outline-none text-[#1f2933]"
                          value={linkBook}
                          onChange={(e) => {
                            setLinkBook(e.target.value);
                            setLinkChapter(1);
                            setLinkVerseStart("");
                            setLinkVerseEnd("");
                          }}
                        >
                          <option value="">{t("grup_renungan.select_book")}</option>
                          {BIBLE_BOOKS.map(b => (
                            <option key={b.id} value={b.name}>{b.name}</option>
                          ))}
                        </select>

                        {linkBook && (
                          <select
                            className="cursor-pointer rounded border border-[#dfd8ca] bg-white px-2.5 py-1.5 outline-none text-[#1f2933]"
                            value={linkChapter}
                            onChange={(e) => {
                              setLinkChapter(Number(e.target.value));
                              setLinkVerseStart("");
                              setLinkVerseEnd("");
                            }}
                          >
                            {Array.from({ length: BIBLE_BOOKS.find(b => b.name === linkBook)?.chapters || 50 }).map((_, i) => (
                              <option key={i + 1} value={i + 1}>{t("grup_renungan.chapter")} {i + 1}</option>
                            ))}
                          </select>
                        )}

                        {linkBook && (
                          <select
                            className="cursor-pointer rounded border border-[#dfd8ca] bg-white px-2.5 py-1.5 outline-none text-[#1f2933]"
                            value={linkVerseStart}
                            onChange={(e) => {
                              setLinkVerseStart(e.target.value);
                              setLinkVerseEnd("");
                            }}
                          >
                            <option value="">{t("grup_renungan.all_verses")}</option>
                            {Array.from({ length: 150 }).map((_, i) => (
                              <option key={i + 1} value={i + 1}>{t("grup_renungan.verse")} {i + 1}</option>
                            ))}
                          </select>
                        )}

                        {linkBook && linkVerseStart && (
                          <select
                            className="cursor-pointer rounded border border-[#dfd8ca] bg-white px-2.5 py-1.5 outline-none text-[#1f2933]"
                            value={linkVerseEnd}
                            onChange={(e) => setLinkVerseEnd(e.target.value)}
                          >
                            <option value="">{language === "zh" ? "仅该节" : language === "en" ? "Just this verse" : "Hanya ayat ini"}</option>
                            {Array.from({ length: 150 }).slice(Number(linkVerseStart)).map((_, i) => {
                              const verseNum = Number(linkVerseStart) + i + 1;
                              return <option key={verseNum} value={verseNum}>{language === "zh" ? `至第 ${verseNum} 节` : language === "en" ? `To Verse ${verseNum}` : `Sampai Ayat ${verseNum}`}</option>;
                            })}
                          </select>
                        )}

                        {linkBook && (
                          <button
                            type="button"
                            onClick={() => {
                              setLinkBook("");
                              setLinkChapter(1);
                              setLinkVerseStart("");
                              setLinkVerseEnd("");
                            }}
                            className="text-red-600 hover:underline font-semibold ml-auto text-xs cursor-pointer"
                          >
                            {language === "zh" ? "清除链接" : language === "en" ? "Remove Link" : "Hapus Tautan"}
                          </button>
                        )}
                      </div>
                      {postVerseRef && (
                        <div className="mt-2 font-medium text-[#2a6f6f]">
                          {language === "zh" ? "有效链接：" : language === "en" ? "Active link: " : "Tautan aktif: "} <span className="font-bold">{postVerseRef}</span>
                        </div>
                      )}
                    </div>

                    <textarea
                      placeholder={language === "zh" ? "您今天想与弟兄姐妹分享什么信仰反思、静默时间或见证？" : language === "en" ? "What spiritual reflections, quiet time, or testimonies would you like to share with fellow believers today?" : "Apa refleksi iman, saat teduh, atau kesaksian Anda hari ini yang ingin dibagikan ke saudara seiman?"}
                      required
                      value={postContent}
                      onChange={(e) => setPostContent(e.target.value)}
                      className="min-h-[100px] rounded border border-[#dfd8ca] bg-white px-3 py-2 text-sm text-[#1f2933]"
                      maxLength={1500}
                    />
                    <button
                      type="submit"
                      disabled={submittingPost || !postContent.trim()}
                      className="rounded bg-[#14213d] px-5 py-2.5 font-semibold text-white text-sm transition hover:bg-[#2a6f6f] disabled:opacity-50 self-end w-fit cursor-pointer"
                    >
                      {submittingPost ? t("grup_renungan.posting") : t("grup_renungan.post_btn")}
                    </button>
                  </form>

                  {/* Posts Feed */}
                  <div className="grid gap-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#2a6f6f] mt-4 mb-2">{language === "zh" ? "最新讨论" : language === "en" ? "Latest Discussions" : "Diskusi Terbaru"}</h3>
                    {loadingPosts ? (
                      <p className="text-center py-6 text-[#52606d] italic bg-white rounded border border-[#dfd8ca]">{language === "zh" ? "正在加载帖子..." : language === "en" ? "Loading posts..." : "Memuat kiriman..."}</p>
                    ) : posts.length === 0 ? (
                      <p className="text-center py-10 text-[#52606d] italic bg-white rounded border border-[#dfd8ca]">
                        {language === "zh" ? "本小组暂无讨论。成为第一个分享默想的人吧！" : language === "en" ? "No discussions in this group yet. Be the first to share your reflection!" : "Belum ada diskusi di grup ini. Jadilah yang pertama membagikan refleksi!"}
                      </p>
                    ) : (
                      posts.map((post) => (
                        <article key={post.id} className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm hover:shadow-md transition">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-bold text-[#14213d]">{post.authorName}</h4>
                              <time className="text-xs text-[#52606d]">{formatTime(post.createdAt)}</time>
                            </div>
                            <span className="rounded bg-[#e9f5db] px-2.5 py-1 text-xs font-semibold text-[#284b3a]">
                              {language === "zh" ? "成员" : language === "en" ? "Member" : "Anggota"}
                            </span>
                          </div>

                          {post.verseRef && (
                            <Link
                              href={`/alkitab?search=${encodeURIComponent(post.verseRef)}`}
                              className="mb-3 block rounded bg-[#f7f4ee] px-3 py-2 border-l-4 border-[#2a6f6f] text-sm font-semibold text-[#2a6f6f] hover:bg-[#ebd9bd] transition"
                            >
                              📖 {language === "zh" ? "阅读经文" : language === "en" ? "Read Verse" : "Lihat Ayat"}: {post.verseRef}
                            </Link>
                          )}

                          <p className="text-sm leading-relaxed text-[#334155] whitespace-pre-wrap">{post.content}</p>

                          <div className="mt-4 pt-4 border-t border-[#dfd8ca]/60 flex gap-4 text-xs font-semibold">
                            <button
                              onClick={() => setExpandedPost(post)}
                              className="text-[#2a6f6f] hover:underline flex items-center gap-1.5 cursor-pointer"
                            >
                              💬 {language === "zh" ? "评论与讨论" : language === "en" ? "Comment & Discuss" : "Komentari & Diskusi"}
                            </button>
                            <button
                              onClick={() => handleShareDiscussion(post, selectedGroup.name)}
                              className="text-gray-500 hover:underline cursor-pointer"
                            >
                              {t("grup_renungan.share_wa")}
                            </button>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Right Panel: Group Details & Members (only visible if group selected) */}
            {selectedGroup && (
              <aside className="hidden lg:flex flex-col gap-4">
                {/* Group Info Card */}
                <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{selectedGroup.icon}</span>
                      <h2 className="text-lg font-bold text-[#14213d]">{selectedGroup.name}</h2>
                    </div>
                    
                    {/* Admin/Creator edit/delete buttons */}
                    {canManage && (
                      <div className="flex gap-1">
                        <button
                          onClick={startEditingGroup}
                          className="rounded bg-gray-100 p-1 text-[10px] text-gray-700 hover:bg-gray-200 cursor-pointer"
                          title="Edit Grup"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={handleDeleteGroup}
                          className="rounded bg-red-50 p-1 text-[10px] text-red-600 hover:bg-red-100 cursor-pointer"
                          title="Hapus Grup"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Editing Form */}
                  {isEditingGroup && (
                    <form onSubmit={handleUpdateGroup} className="mb-4 grid gap-3 p-3 rounded bg-[#f7f4ee] border border-[#dfd8ca] text-[11px]">
                      <div className="font-bold text-[#14213d]">{t("grup_renungan.edit_group")}</div>
                      <label className="grid gap-0.5">
                        <span>{t("grup_renungan.group_name")}</span>
                        <input
                          type="text"
                          required
                          value={editGroupName}
                          onChange={(e) => setEditGroupName(e.target.value)}
                          className="rounded border border-[#dfd8ca] bg-white px-2 py-1 outline-none"
                        />
                      </label>
                      <label className="grid gap-0.5">
                        <span>{t("grup_renungan.description")}</span>
                        <textarea
                          required
                          value={editGroupDesc}
                          onChange={(e) => setEditGroupDesc(e.target.value)}
                          className="rounded border border-[#dfd8ca] bg-white px-2 py-1 outline-none min-h-[40px]"
                        />
                      </label>
                      <label className="grid gap-0.5">
                        <span>{t("grup_renungan.icon_emoji")}</span>
                        <input
                          type="text"
                          required
                          value={editGroupIcon}
                          onChange={(e) => setEditGroupIcon(e.target.value)}
                          className="rounded border border-[#dfd8ca] bg-white px-2 py-1 outline-none w-10 text-center"
                        />
                      </label>
                      <div className="flex gap-2 justify-end mt-1">
                        <button
                          type="button"
                          onClick={() => setIsEditingGroup(false)}
                          className="rounded border border-gray-300 px-2 py-1 bg-white hover:bg-gray-100 cursor-pointer"
                        >
                          {t("grup_renungan.cancel")}
                        </button>
                        <button
                          type="submit"
                          disabled={updatingGroup}
                          className="rounded bg-[#2a6f6f] px-2 py-1 text-white hover:bg-[#1a4a4a] cursor-pointer"
                        >
                          {updatingGroup ? t("grup_renungan.saving") : t("grup_renungan.save")}
                        </button>
                      </div>
                    </form>
                  )}

                  <p className="text-xs text-[#52606d] mb-4">{selectedGroup.description}</p>
                  
                  {/* Join/Leave Button */}
                  <button
                    onClick={isJoined ? handleLeaveGroup : handleJoinGroup}
                    className={`w-full rounded px-3 py-2 text-xs font-bold transition cursor-pointer ${
                      isJoined 
                        ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100" 
                        : "bg-[#2a6f6f] text-white hover:bg-[#1a4a4a]"
                    }`}
                  >
                    {isJoined ? t("grup_renungan.leave") : t("grup_renungan.join")}
                  </button>
                </div>

                {/* Members list */}
                <div className="rounded-lg border border-[#dfd8ca] bg-white p-5 shadow-sm flex flex-col gap-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#2a6f6f]">{t("grup_renungan.members_label")}</h3>
                  
                  {loadingMembers ? (
                    <p className="text-xs text-[#52606d] italic">{language === "zh" ? "正在加载成员..." : language === "en" ? "Loading members..." : "Memuat anggota..."}</p>
                  ) : members.length === 0 ? (
                    <p className="text-xs text-[#52606d] italic">{language === "zh" ? "无成员" : language === "en" ? "No members" : "Belum ada anggota terdaftar."}</p>
                  ) : (
                    <div className="max-h-[200px] overflow-y-auto pr-1 flex flex-col gap-2 scrollbar-thin">
                      {members.map((member) => (
                        <div key={member.id} className="flex items-center gap-2 text-xs">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#14213d] text-[10px] font-bold text-[#ffd166]">
                            {member.name.charAt(0).toUpperCase()}
                          </span>
                          <div className="flex flex-col truncate">
                            <span className="font-semibold text-gray-700 truncate">{member.name}</span>
                            {member.email && member.email !== member.name && (
                              <span className="text-[9px] text-gray-400 truncate">{member.email}</span>
                            )}
                          </div>
                          {member.isPending && (
                            <span className="ml-auto text-[9px] text-[#b07d0f] font-semibold bg-[#fef3c7] px-1.5 py-0.5 rounded">
                              {t("grup_renungan.pending")}
                            </span>
                          )}
                          {!member.isPending && member.addedByAdmin && (
                            <span className="ml-auto text-[9px] text-[#2a6f6f] font-semibold bg-[#e9f5db] px-1.5 py-0.5 rounded">
                              {language === "zh" ? "手动" : language === "en" ? "Manual" : "Manual"}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Admin/Creator: Add Member Form */}
                  {canManage && (
                    <form onSubmit={handleAddMemberEmail} className="mt-2 border-t border-[#dfd8ca] pt-3 flex flex-col gap-2 text-xs">
                      <div className="font-semibold text-gray-700">{t("grup_renungan.add_member")}</div>
                      <input
                        type="email"
                        placeholder="Alamat Email..."
                        required
                        value={manualMemberEmail}
                        onChange={(e) => setManualMemberEmail(e.target.value)}
                        className="rounded border border-[#dfd8ca] bg-white px-2 py-1 outline-none text-[#1f2933]"
                      />
                      <button
                        type="submit"
                        disabled={submittingMember || !manualMemberEmail.trim()}
                        className="rounded bg-[#14213d] px-2 py-1.5 font-bold text-white transition hover:bg-[#2a6f6f] disabled:opacity-50 cursor-pointer"
                      >
                        {submittingMember ? t("grup_renungan.adding") : t("grup_renungan.add_member_btn")}
                      </button>
                    </form>
                  )}
                </div>
              </aside>
            )}
          </div>
        )}
      </div>

      {/* Expanded Post Comments Modal */}
      {expandedPost && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-[#dfd8ca] bg-white p-6 text-[#1f2933] shadow-2xl animate-in zoom-in-95 duration-200 scrollbar-thin">
            {/* Close Button */}
            <button
              onClick={() => setExpandedPost(null)}
              className="absolute right-4 top-4 text-[#52606d] hover:text-[#14213d] cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Post details */}
            <div className="border-b border-[#dfd8ca] pb-4 mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-[#2a6f6f] block mb-2">
                {language === "zh" ? `讨论论坛 • ${selectedGroup.name}` : language === "en" ? `Discussion Forum • ${selectedGroup.name}` : `Forum Diskusi • ${selectedGroup.name}`}
              </span>
              <h3 className="font-bold text-lg text-[#14213d]">{expandedPost.authorName}</h3>
              <time className="text-xs text-[#52606d] block mb-3">{formatTime(expandedPost.createdAt)}</time>
              
              {expandedPost.verseRef && (
                <Link
                  href={`/alkitab?search=${encodeURIComponent(expandedPost.verseRef)}`}
                  className="mb-3 inline-block rounded bg-[#f7f4ee] px-3 py-1.5 border-l-4 border-[#2a6f6f] text-xs font-semibold text-[#2a6f6f] hover:bg-[#ebd9bd] transition"
                >
                  📖 {language === "zh" ? "阅读经文" : language === "en" ? "Read Verse" : "Lihat Ayat"}: {expandedPost.verseRef}
                </Link>
              )}
              <p className="text-sm leading-relaxed text-[#334155] whitespace-pre-wrap bg-[#f7f4ee]/50 p-4 rounded border border-[#dfd8ca]/60">
                {expandedPost.content}
              </p>
            </div>

            {/* Comments List */}
            <div className="mb-6">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[#2a6f6f] mb-3">{language === "zh" ? "意见专栏" : language === "en" ? "Comment Section" : "Kolom Komentar"}</h4>
              
              {loadingComments ? (
                <p className="text-xs text-[#52606d] italic py-2">{language === "zh" ? "正在加载评论..." : language === "en" ? "Loading comments..." : "Memuat komentar..."}</p>
              ) : comments.length === 0 ? (
                <p className="text-xs text-[#52606d] italic py-2">{language === "zh" ? "暂无回复。成为第一个做出回应的人！" : language === "en" ? "No comments yet. Be the first to respond!" : "Belum ada tanggapan. Jadilah yang pertama memberikan respon!"}</p>
              ) : (
                <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin">
                  {comments.map((comment) => (
                    <div key={comment.id} className="rounded bg-[#f7f4ee]/30 border border-[#dfd8ca] p-3 text-xs leading-relaxed">
                      <div className="flex justify-between items-center mb-1">
                        <strong className="text-[#14213d]">{comment.authorName}</strong>
                        <time className="text-[10px] text-gray-500">{formatTime(comment.createdAt)}</time>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comment Form */}
            <form onSubmit={handleAddComment} className="grid gap-3 pt-3 border-t border-[#dfd8ca]">
              <textarea
                placeholder={language === "zh" ? "写下您的意见、属灵回应或祷告支持..." : language === "en" ? "Write a comment, spiritual response, or supporting prayer..." : "Tuliskan komentar, respon rohani, atau doa dukungan Anda..."}
                required
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[80px] rounded border border-[#dfd8ca] bg-white px-3 py-2 text-xs text-[#1f2933]"
                maxLength={800}
              />
              <button
                type="submit"
                disabled={submittingComment || !newComment.trim()}
                className="rounded bg-[#14213d] px-4 py-2 font-semibold text-white text-xs transition hover:bg-[#2a6f6f] disabled:opacity-50 self-end w-fit cursor-pointer"
              >
                {submittingComment ? t("grup_renungan.creating") : t("grup_renungan.comment_btn")}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
