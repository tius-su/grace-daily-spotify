"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, Timestamp } from "firebase/firestore";

type ReadingPlan = { id: string; name: string; totalDays: number; currentDay: number; status: string; groupId?: string; isGroup: boolean };
type DailyReading = { id: string; planId: string; day: number; book: string; chapterStart: number; chapterEnd: number; completed: boolean };
type ReadingGroup = { id: string; name: string; memberCount: number; createdAt: Timestamp };
type GroupMember = { id: string; groupId: string; email: string; name: string; role: string; joinedAt: Timestamp };

export default function ReadingPlanTracker() {
  const [plans, setPlans] = useState<ReadingPlan[]>([]);
  const [groups, setGroups] = useState<ReadingGroup[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ReadingPlan | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ReadingGroup | null>(null);
  const [dailyReadings, setDailyReadings] = useState<DailyReading[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [planName, setPlanName] = useState("");
  const [totalDays, setTotalDays] = useState("365");
  const [groupName, setGroupName] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [inputMode, setInputMode] = useState<"auto" | "manual">("auto");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState("member");

  useEffect(() => {
    if (!db) return;
    const plansQ = query(collection(db, "reading_plans"), orderBy("createdAt", "desc"));
    const groupsQ = query(collection(db, "reading_groups"), orderBy("createdAt", "desc"));
    
    const plansUnsubscribe = onSnapshot(plansQ, (snapshot) => {
      setPlans(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ReadingPlan[]);
    });
    
    const groupsUnsubscribe = onSnapshot(groupsQ, (snapshot) => {
      setGroups(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ReadingGroup[]);
    });
    
    return () => {
      plansUnsubscribe();
      groupsUnsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!db || !selectedGroup) return;
    const membersQ = query(collection(db, "reading_group_members"), orderBy("joinedAt", "desc"));
    const unsubscribe = onSnapshot(membersQ, (snapshot) => {
      setMembers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as GroupMember[]);
    });
    return () => unsubscribe();
  }, [selectedGroup]);

  useEffect(() => {
    if (!db || !selectedPlan) return;
    const readingsQ = query(collection(db, "daily_readings"), orderBy("day", "asc"));
    const unsubscribe = onSnapshot(readingsQ, (snapshot) => {
      setDailyReadings(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as DailyReading[]);
    });
    return () => unsubscribe();
  }, [selectedPlan]);

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName || !db) return;
    const groupRef = await addDoc(collection(db!, "reading_groups"), { name: groupName, memberCount: 1, createdAt: Timestamp.now() });
    setGroupName("");
    setIsCreatingGroup(false);
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !memberEmail || !db) return;
    await addDoc(collection(db!, "reading_group_members"), {
      groupId: selectedGroup.id,
      email: memberEmail,
      name: memberName || memberEmail.split("@")[0],
      role: memberRole,
      joinedAt: Timestamp.now()
    });
    const groupRef = doc(db!, "reading_groups", selectedGroup.id);
    await updateDoc(groupRef, { memberCount: members.length + 1 });
    setMemberEmail("");
    setMemberName("");
    setMemberRole("member");
    setIsAddingMember(false);
  };

  const updateMember = async (memberId: string, role: string) => {
    if (!db) return;
    await updateDoc(doc(db!, "reading_group_members", memberId), { role });
  };

  const deleteMember = async (memberId: string) => {
    if (!confirm("Yakin hapus anggota ini?") || !db) return;
    await deleteDoc(doc(db!, "reading_group_members", memberId));
    if (selectedGroup) {
      const groupRef = doc(db!, "reading_groups", selectedGroup.id);
      await updateDoc(groupRef, { memberCount: Math.max(0, members.length - 1) });
    }
  };

  const createPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName || !db) return;
    
    const planRef = await addDoc(collection(db!, "reading_plans"), {
      name: planName,
      totalDays: Number(totalDays),
      currentDay: 1,
      status: "active",
      groupId: selectedGroupId || undefined,
      isGroup: !!selectedGroupId,
      createdAt: Timestamp.now()
    });

    if (inputMode === "auto") {
      const books = ["Kejadian", "Keluaran", "Imamat", "Bilangan", "Ulangan", "Yosua", "Hakim-hakim", "Rut", "1 Samuel", "2 Samuel", "1 Raja-raja", "2 Raja-raja", "1 Tawarikh", "2 Tawarikh", "Ezra", "Nehemia", "Ester", "Ayub", "Mazmur", "Amsal", "Pengkhotbah", "Kidung Agung", "Yesaya", "Yeremia", "Ratapan", "Yehezkiel", "Daniel", "Hosea", "Yoel", "Amos", "Obaja", "Yona", "Mikha", "Nahum", "Habakuk", "Zefanya", "Haggai", "Zakharia", "Maleakhi", "Matius", "Markus", "Lukas", "Yohanes", "Kisah Para Rasul", "Roma", "1 Korintus", "2 Korintus", "Galatia", "Efesus", "Filipi", "Kolose", "1 Tesalonika", "2 Tesalonika", "1 Timotius", "2 Timotius", "Titus", "Filemon", "Ibrani", "Yakobus", "1 Petrus", "2 Petrus", "1 Yohanes", "2 Yohanes", "3 Yohanes", "Yudas", "Wahyu"];
      for (let day = 1; day <= Number(totalDays); day++) {
        const bookIndex = Math.floor((day - 1) / (Number(totalDays) / books.length));
        const book = books[Math.min(bookIndex, books.length - 1)];
        const chapter = Math.ceil((day % 10) || 1);
        await addDoc(collection(db!, "daily_readings"), { planId: planRef.id, day, book, chapterStart: chapter, chapterEnd: chapter, completed: false });
      }
    } else {
      // Manual input parsing
      const lines = manualInput.split("\n").filter(line => line.trim());
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const parts = line.split(/[\s,]+/);
        const book = parts[0];
        const chapterStart = parseInt(parts[1]) || 1;
        const chapterEnd = parseInt(parts[2]) || chapterStart;
        await addDoc(collection(db!, "daily_readings"), { planId: planRef.id, day: i + 1, book, chapterStart, chapterEnd, completed: false });
      }
    }
    
    setPlanName("");
    setTotalDays("365");
    setSelectedGroupId("");
    setManualInput("");
    setInputMode("auto");
    setIsCreating(false);
  };

  const toggleComplete = async (reading: DailyReading) => {
    if (!db) return;
    await updateDoc(doc(db!, "daily_readings", reading.id), { completed: !reading.completed });
  };

  const deletePlan = async (planId: string) => {
    if (!confirm("Yakin?") || !db) return;
    await deleteDoc(doc(db!, "reading_plans", planId));
    setSelectedPlan(null);
  };

  const deleteGroup = async (groupId: string) => {
    if (!confirm("Yakin hapus group ini?") || !db) return;
    await deleteDoc(doc(db!, "reading_groups", groupId));
    setSelectedGroup(null);
  };

  return (
    <div className="min-h-screen bg-[#f7f4ee] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-[#14213d]">Tracker Rencana Bacaan</h1>
          <button onClick={() => setShowGuide(!showGuide)} className="text-[#2a6f6f] font-semibold hover:underline">
            {showGuide ? "Tutup Panduan" : "Panduan"}
          </button>
        </div>

        {showGuide && (
          <div className="bg-white rounded-lg border border-[#dfd8ca] p-6 mb-6">
            <h2 className="text-xl font-semibold text-[#14213d] mb-4">Panduan Penggunaan</h2>
            <div className="space-y-4 text-[#14213d]">
              <div>
                <h3 className="font-semibold text-lg mb-2">📖 Apa itu Tracker Rencana Bacaan?</h3>
                <p className="text-sm">Fitur untuk melacak progress bacaan Alkitab harian secara sistematis. Anda bisa membuat rencana bacaan pribadi atau bergabung dengan grup bacaan bersama teman/keluarga.</p>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">👥 Grup Bacaan</h3>
                <ul className="text-sm list-disc list-inside space-y-1">
                  <li><strong>Buat Grup:</strong> Klik "Buat Grup" dan masukkan nama grup</li>
                  <li><strong>Kelola Anggota:</strong> Klik "Kelola" pada grup untuk tambah/hapus anggota via email</li>
                  <li><strong>Role:</strong> Admin bisa mengelola anggota, Member hanya bisa melihat</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">📝 Membuat Rencana Bacaan</h3>
                <ul className="text-sm list-disc list-inside space-y-1">
                  <li><strong>Auto-generate:</strong> Sistem otomatis generate dari Kejadian sampai Wahyu berdasarkan total hari</li>
                  <li><strong>Input Manual:</strong> Input ayat spesifik dengan format: <code className="bg-[#f7f4ee] px-2 py-1 rounded">Kitab PasalAwal PasalAkhir</code></li>
                  <li><strong>Contoh:</strong> Kejadian 1 3, Keluaran 20 20, Mazmur 23 23</li>
                  <li><strong>Hubungkan ke Grup:</strong> Pilih grup saat membuat rencana untuk tracking bersama</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">✅ Melacak Progress</h3>
                <ul className="text-sm list-disc list-inside space-y-1">
                  <li>Klik "Lihat" pada rencana untuk melihat jadwal bacaan harian</li>
                  <li>Centang checkbox setelah selesai membaca ayat hari ini</li>
                  <li>Progress akan terupdate secara otomatis</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2">💡 Tips</h3>
                <ul className="text-sm list-disc list-inside space-y-1">
                  <li>Buat grup untuk komsel atau keluarga untuk saling mengingatkan</li>
                  <li>Gunakan input manual untuk rencana bacaan spesifik (misal: hanya Perjanjian Baru)</li>
                  <li>Set target realistis (misal: 1-2 pasal per hari)</li>
                </ul>
              </div>
            </div>
          </div>
        )}
        
        {!selectedPlan && !selectedGroup ? (
          <div className="space-y-6">
            {/* Groups Section */}
            <div className="bg-white rounded-lg border border-[#dfd8ca] p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Grup Bacaan</h2>
                <button onClick={() => setIsCreatingGroup(!isCreatingGroup)} className="bg-[#2a6f6f] text-white px-4 py-2 rounded-md">
                  {isCreatingGroup ? "Batal" : "Buat Grup"}
                </button>
              </div>
              
              {isCreatingGroup && (
                <form onSubmit={createGroup} className="space-y-4 mb-4">
                  <input value={groupName} onChange={(e) => setGroupName(e.target.value)} className="w-full border p-2 rounded" placeholder="Nama grup" required />
                  <button className="bg-[#2a6f6f] text-white px-4 py-2 rounded">Simpan Grup</button>
                </form>
              )}
              
              <div className="space-y-2">
                {groups.map((group) => (
                  <div key={group.id} className="flex justify-between items-center p-3 bg-[#f7f4ee] rounded">
                    <div>
                      <p className="font-semibold">{group.name}</p>
                      <p className="text-sm text-gray-600">{group.memberCount} anggota</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedGroup(group)} className="text-blue-600">Kelola</button>
                      <button onClick={() => deleteGroup(group.id)} className="text-red-600">Hapus</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Plans Section */}
            <div className="bg-white rounded-lg border border-[#dfd8ca] p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Rencana Bacaan</h2>
                <button onClick={() => setIsCreating(!isCreating)} className="bg-[#2a6f6f] text-white px-4 py-2 rounded-md">
                  {isCreating ? "Batal" : "Buat Baru"}
                </button>
              </div>
              
              {isCreating && (
                <form onSubmit={createPlan} className="space-y-4 mb-4">
                  <input value={planName} onChange={(e) => setPlanName(e.target.value)} className="w-full border p-2 rounded" placeholder="Nama rencana" required />
                  <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className="w-full border p-2 rounded">
                    <option value="">Pilih Grup (opsional)</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={inputMode === "auto"} onChange={() => setInputMode("auto")} />
                      Auto-generate (Kejadian - Wahyu)
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={inputMode === "manual"} onChange={() => setInputMode("manual")} />
                      Input Manual
                    </label>
                  </div>
                  {inputMode === "auto" ? (
                    <input value={totalDays} onChange={(e) => setTotalDays(e.target.value)} className="w-full border p-2 rounded" placeholder="Total hari" type="number" />
                  ) : (
                    <textarea 
                      value={manualInput} 
                      onChange={(e) => setManualInput(e.target.value)} 
                      className="w-full border p-2 rounded min-h-32" 
                      placeholder="Input ayat manual (format: Kitab PasalAwal PasalAkhir)&#10;Contoh:&#10;Kejadian 1 3&#10;Keluaran 20 20&#10;Mazmur 23 23"
                    />
                  )}
                  <button className="bg-[#2a6f6f] text-white px-4 py-2 rounded">Simpan</button>
                </form>
              )}
              
              <div className="space-y-2">
                {plans.map((plan) => (
                  <div key={plan.id} className="flex justify-between items-center p-3 bg-[#f7f4ee] rounded">
                    <div>
                      <p className="font-semibold">{plan.name} {plan.isGroup && "👥"}</p>
                      <p className="text-sm text-gray-600">{plan.currentDay}/{plan.totalDays} hari</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedPlan(plan)} className="text-blue-600">Lihat</button>
                      <button onClick={() => deletePlan(plan.id)} className="text-red-600">Hapus</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : selectedGroup ? (
          <div className="bg-white rounded-lg border border-[#dfd8ca] p-6">
            <button onClick={() => setSelectedGroup(null)} className="mb-4 text-blue-600">← Kembali</button>
            <h2 className="text-xl font-semibold mb-4">Kelola Anggota: {selectedGroup.name}</h2>
            
            {/* Add Member Form */}
            <div className="mb-6">
              <button onClick={() => setIsAddingMember(!isAddingMember)} className="bg-[#2a6f6f] text-white px-4 py-2 rounded-md mb-4">
                {isAddingMember ? "Batal" : "Tambah Anggota"}
              </button>
              
              {isAddingMember && (
                <form onSubmit={addMember} className="space-y-4 mb-4 p-4 bg-[#f7f4ee] rounded">
                  <input 
                    value={memberEmail} 
                    onChange={(e) => setMemberEmail(e.target.value)} 
                    className="w-full border p-2 rounded" 
                    placeholder="Email anggota" 
                    type="email" 
                    required 
                  />
                  <input 
                    value={memberName} 
                    onChange={(e) => setMemberName(e.target.value)} 
                    className="w-full border p-2 rounded" 
                    placeholder="Nama (opsional)" 
                  />
                  <select 
                    value={memberRole} 
                    onChange={(e) => setMemberRole(e.target.value)} 
                    className="w-full border p-2 rounded"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button className="bg-[#2a6f6f] text-white px-4 py-2 rounded">Tambah</button>
                </form>
              )}
            </div>

            {/* Members List */}
            <div className="space-y-2">
              <h3 className="font-semibold text-lg mb-2">Daftar Anggota ({members.filter(m => m.groupId === selectedGroup.id).length})</h3>
              {members.filter(m => m.groupId === selectedGroup.id).map((member) => (
                <div key={member.id} className="flex justify-between items-center p-3 bg-[#f7f4ee] rounded">
                  <div>
                    <p className="font-semibold">{member.name}</p>
                    <p className="text-sm text-gray-600">{member.email}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${member.role === "admin" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                      {member.role}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <select 
                      value={member.role} 
                      onChange={(e) => updateMember(member.id, e.target.value)} 
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button onClick={() => deleteMember(member.id)} className="text-red-600 text-sm">Hapus</button>
                  </div>
                </div>
              ))}
              {members.filter(m => m.groupId === selectedGroup.id).length === 0 && (
                <p className="text-gray-500 text-center py-4">Belum ada anggota</p>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-[#dfd8ca] p-6">
            <button onClick={() => setSelectedPlan(null)} className="mb-4 text-blue-600">← Kembali</button>
            <h2 className="text-xl font-semibold mb-4">{selectedPlan?.name}</h2>
            <div className="space-y-2">
              {dailyReadings.filter((r) => r.planId === selectedPlan?.id).map((reading) => (
                <div key={reading.id} className="flex justify-between items-center p-3 bg-[#f7f4ee] rounded">
                  <div>
                    <p className="font-semibold">Hari {reading.day}: {reading.book} {reading.chapterStart === reading.chapterEnd ? reading.chapterStart : `${reading.chapterStart}-${reading.chapterEnd}`}</p>
                  </div>
                  <input type="checkbox" checked={reading.completed} onChange={() => toggleComplete(reading)} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
