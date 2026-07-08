import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, updateDoc, setDoc, getDocs, where, deleteDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ==========================================
// --- MAGIC UI INJECTION (DARK MODE & STYLES) ---
// ==========================================
function injectUIStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
        :root {
            --bg-color: #f0f2f5; --card-bg: #ffffff; --text-color: #111111;
            --sub-text: #555555; --border-color: #e0e0e0; --hover-bg: #f5f5f5; --input-bg: #ffffff;
        }
        [data-theme="dark"] {
            --bg-color: #121212; --card-bg: #1e1e1e; --text-color: #e0e0e0;
            --sub-text: #aaaaaa; --border-color: #333333; --hover-bg: #2a2a2a; --input-bg: #2d2d2d;
        }
        body { background-color: var(--bg-color); color: var(--text-color); transition: background-color 0.3s, color 0.3s; }
        .added-image-container, .chat-item, #chat-box, #requests-list, #links-list, #tab-container, #chat-menu-dropdown { 
            background: var(--card-bg) !important; color: var(--text-color) !important; border-color: var(--border-color) !important; 
        }
        input[type="text"], input[type="password"] {
            background: var(--input-bg) !important; color: var(--text-color) !important; border: 1px solid var(--border-color) !important;
        }
        @keyframes fadeInSlideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .added-image-container, .chat-item { animation: fadeInSlideUp 0.4s ease-out; }
        .letter-avatar { 
            width: 45px; height: 45px; border-radius: 50%; display: flex; align-items: center; justify-content: center; 
            color: white; font-weight: bold; font-size: 20px; margin-right: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .message { box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
        .message.sent { border-bottom-right-radius: 0px !important; }
        .message.received { border-bottom-left-radius: 0px !important; background: var(--hover-bg) !important; color: var(--text-color) !important; }
        button { transition: transform 0.1s, opacity 0.2s; }
        button:active { transform: scale(0.92); }
        button:hover { opacity: 0.9; }
        #block-user-btn:hover { background: var(--hover-bg); }
    `;
    document.head.appendChild(style);
}
injectUIStyles();

const darkModeBtn = document.createElement('button');
darkModeBtn.innerHTML = '🌙';
darkModeBtn.style.position = 'fixed';
darkModeBtn.style.bottom = '100px'; 
darkModeBtn.style.right = '20px';
darkModeBtn.style.zIndex = '99999';
darkModeBtn.style.borderRadius = '50%';
darkModeBtn.style.width = '55px';
darkModeBtn.style.height = '55px';
darkModeBtn.style.fontSize = '24px';
darkModeBtn.style.border = 'none';
darkModeBtn.style.background = '#ffffff';
darkModeBtn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
darkModeBtn.style.cursor = 'pointer';
darkModeBtn.style.display = 'none'; 

darkModeBtn.onclick = () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    darkModeBtn.innerHTML = isDark ? '🌙' : '☀️';
    darkModeBtn.style.background = isDark ? '#ffffff' : '#333333';
};
document.body.appendChild(darkModeBtn);

function getAvatarColor(name) {
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#ff9800', '#ff5722'];
    let sum = 0;
    for(let i=0; i<name.length; i++) sum += name.charCodeAt(i);
    return colors[sum % colors.length];
}

const firebaseConfig = {
  apiKey: "AIzaSyBwsMbPGzq73oMxqOfOz7673GwMGVzi-gg",
  authDomain: "sagar-portfolio-d89f9.firebaseapp.com",
  databaseURL: "https://sagar-portfolio-d89f9-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sagar-portfolio-d89f9",
  storageBucket: "sagar-portfolio-d89f9.firebasestorage.app",
  messagingSenderId: "848087329356",
  appId: "1:848087329356:web:5e3c0c3baa9dcbee07e2e9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); 

const screens = {
    login: document.getElementById('login-screen'),
    inbox: document.getElementById('inbox-screen'),
    chat: document.getElementById('chat-screen')
};

// Fix for Login Screen Flash: Hide login immediately by default via JS
if(screens.login) screens.login.style.display = 'none';

let currentUser = null;
let activeChatUser = null;
let currentChatUnsubscribe = null; 
let myBlockedUsers = []; 

window.showToast = function(message, type = "success") {
    const toast = document.getElementById("toast");
    if(!toast) return;
    toast.innerText = message;
    toast.className = `show ${type}`;
    setTimeout(() => { toast.className = toast.className.replace("show", "").trim(); }, 3000);
};

document.getElementById('signup-btn').onclick = async () => {
    const email = document.getElementById('email-input').value.trim();
    const pass = document.getElementById('password-input').value.trim();
    if(!email || !pass) return showToast("Please enter valid email and password.", "error");
    try {
        const userCred = await createUserWithEmailAndPassword(auth, email, pass);
        await setDoc(doc(db, "users", userCred.user.uid), { email: email, uid: userCred.user.uid, blockedUsers: [] });
        showToast("Account created successfully!", "success");
    } catch (e) { showToast("Signup Error: " + e.message, "error"); }
};

document.getElementById('login-btn').onclick = () => {
    const email = document.getElementById('email-input').value.trim();
    const pass = document.getElementById('password-input').value.trim();
    if(!email || !pass) return showToast("Please enter email and password.", "error");
    signInWithEmailAndPassword(auth, email, pass)
        .then(() => showToast("Logged in successfully!", "success"))
        .catch(e => showToast("Invalid credentials.", "error"));
};

document.getElementById('logout-btn').onclick = () => {
    signOut(auth);
    showToast("Logged out successfully.", "info");
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('my-email').innerText = user.email.split('@')[0];
        darkModeBtn.style.display = 'block'; 
        
        try {
            await setDoc(doc(db, "users", user.uid), { email: user.email, uid: user.uid }, { merge: true });
            
            // Listen to my own document for Realtime Block Updates
            onSnapshot(doc(db, "users", user.uid), (docSnap) => {
                if (docSnap.exists()) {
                    myBlockedUsers = docSnap.data().blockedUsers || [];
                    if (activeChatUser) updateBlockUI(); 
                }
            });

        } catch (error) { console.error("Database error:", error); }

        showScreen('inbox');
        loadInboxUsers();
        loadPendingRequests();
        if(window.loadGlobalLinks) window.loadGlobalLinks();

    } else {
        currentUser = null;
        myBlockedUsers = [];
        showScreen('login');
        darkModeBtn.style.display = 'none'; 
        document.getElementById('email-input').value = "";
        document.getElementById('password-input').value = "";
    }
});

function showScreen(screenName) {
    screens.login.style.display = screenName === 'login' ? 'flex' : 'none';
    screens.inbox.style.display = screenName === 'inbox' ? 'flex' : 'none';
    screens.chat.style.display = screenName === 'chat' ? 'flex' : 'none';
}

let allUsersList = [];
let connectionStatusMap = {};

function loadInboxUsers() {
    onSnapshot(query(collection(db, "users")), (userSnapshot) => {
        allUsersList = [];
        userSnapshot.forEach((doc) => {
            if (doc.data().uid !== currentUser.uid) allUsersList.push(doc.data());
        });
        renderInboxUI();
        if (activeChatUser) updateBlockUI(); 
    });

    onSnapshot(query(collection(db, "requests"), where("senderId", "==", currentUser.uid)), (snap) => {
        snap.forEach(doc => connectionStatusMap[doc.data().receiverId] = doc.data().status);
        renderInboxUI();
    });

    onSnapshot(query(collection(db, "requests"), where("receiverId", "==", currentUser.uid)), (snap) => {
        snap.forEach(doc => connectionStatusMap[doc.data().senderId] = doc.data().status);
        renderInboxUI();
    });
}

function renderInboxUI() {
    const chatList = document.getElementById('chat-list');
    if (!chatList) return;
    chatList.innerHTML = '';

    const searchInput = document.getElementById('search-users');
    const filterText = searchInput ? searchInput.value.toLowerCase().trim() : '';

    allUsersList.forEach((user) => {
        const userName = user.email.split('@')[0];
        if (filterText && !userName.toLowerCase().includes(filterText)) return; 

        const div = document.createElement('div');
        div.className = 'chat-item';
        div.style.background = 'var(--card-bg)';
        div.style.borderBottom = '1px solid var(--border-color)';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.padding = '12px 15px';
        
        const status = connectionStatusMap[user.uid];
        let buttonHTML = '';
        let subText = 'New User';
        
        const avatarColor = getAvatarColor(userName);
        const avatarLetter = userName.charAt(0).toUpperCase();

        if (myBlockedUsers.includes(user.uid)) {
            subText = '<span style="color: #f44336; font-weight:bold;">Blocked</span>';
        } else if (status === 'accepted') {
            subText = 'Tap to chat';
        } else if (status === 'pending') {
            subText = 'Request Pending';
            buttonHTML = `<button class="btn-connect" style="background: var(--border-color); color: var(--sub-text); border: none; padding: 6px 15px; border-radius: 20px; font-weight: bold; font-size: 13px; cursor: not-allowed;" disabled>Pending</button>`;
        } else {
            buttonHTML = `<button class="btn-connect action-connect" style="background: #00a884; color: white; border: none; padding: 6px 15px; border-radius: 20px; font-weight: bold; font-size: 13px; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">Connect</button>`;
        }
        
        div.innerHTML = `
            <div class="letter-avatar" style="background: ${avatarColor};">${avatarLetter}</div>
            <div class="chat-details" style="flex: 1;">
                <strong style="color: var(--text-color); font-size: 15px;">${userName}</strong>
                <span style="font-size: 12px; color: var(--sub-text); display: block; margin-top: 3px;">${subText}</span>
            </div>
            ${buttonHTML}
        `;
        
        if (status === 'accepted' || myBlockedUsers.includes(user.uid)) {
            div.onclick = () => openChatRoom(user); 
        } else {
            div.onclick = () => handleUserClick(user);
            const connectBtn = div.querySelector('.action-connect');
            if (connectBtn) {
                connectBtn.onclick = (e) => {
                    e.stopPropagation(); 
                    handleUserClick(user);
                    connectBtn.innerText = "Pending";
                    connectBtn.style.background = "var(--border-color)";
                    connectBtn.style.color = "var(--sub-text)";
                    connectBtn.disabled = true;
                };
            }
        }
        chatList.appendChild(div);
    });
}

const searchField = document.getElementById('search-users');
if (searchField) searchField.addEventListener('input', renderInboxUI);

async function handleUserClick(targetUser) {
    try {
        const q1 = query(collection(db, "requests"), where("senderId", "==", currentUser.uid), where("receiverId", "==", targetUser.uid));
        const q2 = query(collection(db, "requests"), where("senderId", "==", targetUser.uid), where("receiverId", "==", currentUser.uid));

        const snap1 = await getDocs(q1);
        const snap2 = await getDocs(q2);

        let requestDoc = null;
        if (!snap1.empty) requestDoc = snap1.docs[0];
        else if (!snap2.empty) requestDoc = snap2.docs[0];

        if (!requestDoc) {
            await addDoc(collection(db, "requests"), { senderId: currentUser.uid, receiverId: targetUser.uid, status: "pending" });
            showToast("Connection request sent!", "success");
        } 
        else {
            const reqData = requestDoc.data();
            if (reqData.status === "accepted") { openChatRoom(targetUser); } 
            else if (reqData.status === "pending") {
                if (reqData.senderId === currentUser.uid) { showToast("Your request is still pending approval.", "info"); } 
                else {
                    await updateDoc(doc(db, "requests", requestDoc.id), { status: "accepted" });
                    showToast("Request accepted! You can now chat.", "success");
                    openChatRoom(targetUser);
                }
            } else if (reqData.status === "rejected") {
                await updateDoc(doc(db, "requests", requestDoc.id), { status: "pending", senderId: currentUser.uid, receiverId: targetUser.uid });
                showToast("Connection request sent again!", "success");
            }
        }
    } catch (error) { showToast("Action failed. Please try again.", "error"); }
}

const chatMenuBtn = document.getElementById('chat-menu-btn');
const chatMenuDropdown = document.getElementById('chat-menu-dropdown');
const blockUserBtn = document.getElementById('block-user-btn');
const blockedFooterMsg = document.getElementById('blocked-footer-msg');
const activeChatFooter = document.getElementById('active-chat-footer');
const vCallBtn = document.getElementById('video-call-btn');
const aCallBtn = document.getElementById('audio-call-btn');

chatMenuBtn.onclick = (e) => {
    e.stopPropagation();
    chatMenuDropdown.style.display = chatMenuDropdown.style.display === 'block' ? 'none' : 'block';
};

document.onclick = () => { if(chatMenuDropdown) chatMenuDropdown.style.display = 'none'; };

blockUserBtn.onclick = async () => {
    if (!activeChatUser) return;
    const isCurrentlyBlocked = myBlockedUsers.includes(activeChatUser.uid);
    try {
        const myDocRef = doc(db, "users", currentUser.uid);
        if (isCurrentlyBlocked) {
            await updateDoc(myDocRef, { blockedUsers: arrayRemove(activeChatUser.uid) });
            showToast("User Unblocked", "success");
        } else {
            await updateDoc(myDocRef, { blockedUsers: arrayUnion(activeChatUser.uid) });
            showToast("User Blocked", "error");
        }
        chatMenuDropdown.style.display = 'none';
    } catch (error) { showToast("Error updating block status", "error"); }
};

function isBlockedByThem(uid) {
    const targetUserObj = allUsersList.find(u => u.uid === uid);
    if (targetUserObj && targetUserObj.blockedUsers) {
        return targetUserObj.blockedUsers.includes(currentUser.uid);
    }
    return false;
}

function updateBlockUI() {
    if (!activeChatUser) return;
    
    const amIBlocking = myBlockedUsers.includes(activeChatUser.uid);
    const areTheyBlocking = isBlockedByThem(activeChatUser.uid);
    
    if (amIBlocking) {
        activeChatFooter.style.display = 'none';
        blockedFooterMsg.style.display = 'block';
        blockedFooterMsg.innerText = 'You blocked this contact. Tap to unblock.';
        blockedFooterMsg.onclick = () => { blockUserBtn.click(); }; 
        blockedFooterMsg.style.cursor = 'pointer';
        
        blockUserBtn.innerText = 'Unblock User';
        blockUserBtn.style.color = '#4caf50'; 
        vCallBtn.style.opacity = '0.3'; vCallBtn.style.pointerEvents = 'none';
        aCallBtn.style.opacity = '0.3'; aCallBtn.style.pointerEvents = 'none';
    } 
    else if (areTheyBlocking) {
        activeChatFooter.style.display = 'none';
        blockedFooterMsg.style.display = 'block';
        blockedFooterMsg.innerText = 'You cannot reply to this conversation.';
        blockedFooterMsg.onclick = null; 
        blockedFooterMsg.style.cursor = 'default';
        
        blockUserBtn.innerText = 'Block User'; 
        blockUserBtn.style.color = '#f44336'; 
        vCallBtn.style.opacity = '0.3'; vCallBtn.style.pointerEvents = 'none';
        aCallBtn.style.opacity = '0.3'; aCallBtn.style.pointerEvents = 'none';
    } 
    else {
        activeChatFooter.style.display = 'flex';
        blockedFooterMsg.style.display = 'none';
        blockUserBtn.innerText = 'Block User';
        blockUserBtn.style.color = '#f44336'; 
        vCallBtn.style.opacity = '1'; vCallBtn.style.pointerEvents = 'auto';
        aCallBtn.style.opacity = '1'; aCallBtn.style.pointerEvents = 'auto';
    }
}

// ==========================================
// --- FIX: NATIVE BACK BUTTON LOGIC ---
// ==========================================
document.getElementById('back-btn').onclick = () => {
    // Instead of forcing the screen manually, this will simulate a natural phone back button press
    history.back();
};

window.addEventListener('popstate', function(event) {
    if (activeChatUser) {
        if (currentChatUnsubscribe) currentChatUnsubscribe(); 
        activeChatUser = null;
        showScreen('inbox');
    }
});

function openChatRoom(user) {
    activeChatUser = user;
    document.getElementById('chatting-with-name').innerText = user.email.split('@')[0];
    
    // Inject the current state into phone history to fix the blank screen bug
    history.pushState({ page: 'chat' }, 'Chat', '#chat');

    showScreen('chat');
    updateBlockUI(); 
    
    const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
    if (currentChatUnsubscribe) currentChatUnsubscribe(); 
    
    currentChatUnsubscribe = onSnapshot(q, (snapshot) => {
        const chatBox = document.getElementById('chat-box');
        chatBox.innerHTML = '';
        
        snapshot.forEach((docSnap) => {
            const msg = docSnap.data();
            const msgId = docSnap.id; 
            const isRelatedToMe = (msg.senderId === currentUser.uid && msg.receiverId === activeChatUser.uid) || 
                                  (msg.senderId === activeChatUser.uid && msg.receiverId === currentUser.uid);
            
            if (isRelatedToMe) {
                if (msg.receiverId === currentUser.uid && msg.status !== 'seen') {
                    updateDoc(doc(db, "messages", docSnap.id), { status: 'seen' });
                }
                renderMessage(msg, msgId);
            }
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

function renderMessage(msg, msgId) {
    const chatBox = document.getElementById('chat-box');
    const div = document.createElement('div');
    const isMine = msg.senderId === currentUser.uid;
    div.className = `message ${isMine ? 'sent' : 'received'}`;
    
    let timeString = "";
    let msgDate = msg.timestamp ? msg.timestamp.toDate() : new Date();
    
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    let dateLabel = "";
    if (msgDate.toDateString() === now.toDateString()) {
        dateLabel = "Today";
    } else if (msgDate.toDateString() === yesterday.toDateString()) {
        dateLabel = "Yesterday";
    } else {
        dateLabel = msgDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    const timeLabel = msgDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    timeString = `${dateLabel}, ${timeLabel}`;
    let footerHtml = `<span style="font-size: 10px; margin-right: 5px; opacity: 0.7;">${timeString}</span>`;
    
    if (isMine) {
        let tick = msg.status === 'seen' ? `<span class="tick-blue" style="color: #34b7f1;">✓✓</span>` : `<span>✓</span>`;
        let isDeletable = false;
        if (msg.timestamp) {
            const msgTime = msg.timestamp.toMillis();
            const nowTime = Date.now();
            if ((nowTime - msgTime) <= 300000) { isDeletable = true; }
        } else { isDeletable = true; }

        if (isDeletable) {
            footerHtml += `${tick} <span onclick="openDeleteModal('${msgId}')" style="cursor:pointer; margin-left:8px; font-size:12px;" title="Delete for everyone">🗑️</span>`;
        } else { footerHtml += `${tick}`; }
    }

    function makeLinksClickable(text) {
        if (!text) return "";
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, function(url) {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: #0369a1; text-decoration: underline; word-break: break-all;">${url}</a>`;
        });
    }

    let contentHtml = '';
    if (msg.type === 'image') { contentHtml = `<img src="${msg.mediaUrl}" style="max-width: 200px; border-radius: 8px; margin-bottom: 5px;" />`;
    } else if (msg.type === 'video') { contentHtml = `<video src="${msg.mediaUrl}" controls style="max-width: 200px; border-radius: 8px; margin-bottom: 5px;"></video>`;
    } else { contentHtml = `<div>${makeLinksClickable(msg.text)}</div>`; }

    div.innerHTML = `${contentHtml}<div class="msg-time-tick" style="display:flex; justify-content:flex-end; align-items:center; margin-top:4px;">${footerHtml}</div>`;
    chatBox.appendChild(div);
}

let messageToDelete = null;
window.openDeleteModal = (msgId) => {
    messageToDelete = msgId;
    document.getElementById('custom-confirm').style.display = 'flex';
};
document.getElementById('confirm-cancel').onclick = () => {
    document.getElementById('custom-confirm').style.display = 'none';
    messageToDelete = null;
};
document.getElementById('confirm-ok').onclick = async () => {
    if (messageToDelete) {
        try {
            await deleteDoc(doc(db, "messages", messageToDelete));
            showToast("Message deleted", "info");
        } catch (error) {}
        document.getElementById('custom-confirm').style.display = 'none';
        messageToDelete = null;
    }
};

const messageInputField = document.getElementById('message-input');
if (messageInputField) {
    messageInputField.addEventListener('input', () => {
        const micBtn = document.getElementById('mic-btn');
        const sendBtn = document.getElementById('send-btn');
        if (micBtn && sendBtn) {
            if (messageInputField.value.trim().length > 0) {
                micBtn.style.display = 'none'; sendBtn.style.display = 'flex';
            } else {
                micBtn.style.display = 'flex'; sendBtn.style.display = 'none';
            }
        }
    });
}

document.getElementById('send-btn').onclick = async () => {
    if (myBlockedUsers.includes(activeChatUser.uid) || isBlockedByThem(activeChatUser.uid)) {
        return showToast("Cannot send message.", "error");
    }

    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = ""; 
    
    const micBtn = document.getElementById('mic-btn');
    const sendBtn = document.getElementById('send-btn');
    if (micBtn && sendBtn) { micBtn.style.display = 'flex'; sendBtn.style.display = 'none'; }

    await addDoc(collection(db, "messages"), {
        text: text, type: 'text', senderId: currentUser.uid, receiverId: activeChatUser.uid, status: "sent", timestamp: serverTimestamp()
    });
};

document.getElementById('file-input').onchange = async (e) => {
    if (myBlockedUsers.includes(activeChatUser.uid) || isBlockedByThem(activeChatUser.uid)) {
        return showToast("Cannot send files.", "error");
    }
    const file = e.target.files[0];
    if (!file) return;
    showToast("Uploading media...", "info");
    const fileRef = ref(storage, `chat_media/${Date.now()}_${file.name}`);
    try {
        const snapshot = await uploadBytesResumable(fileRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        let msgType = file.type.startsWith('video/') ? 'video' : 'image';
        await addDoc(collection(db, "messages"), {
            text: "", mediaUrl: downloadURL, type: msgType, senderId: currentUser.uid, receiverId: activeChatUser.uid, status: "sent", timestamp: serverTimestamp()
        });
        showToast("Media sent!", "success");
    } catch (error) { showToast("Failed to upload.", "error"); }
    e.target.value = ""; 
};

const tabUsers = document.getElementById('tab-users');
const tabRequests = document.getElementById('tab-requests');
const tabLinks = document.getElementById('tab-links');
const chatList = document.getElementById('chat-list');
const reqList = document.getElementById('requests-list');
const linksList = document.getElementById('links-list');

function switchTab(activeTab, activeList) {
    [tabUsers, tabRequests, tabLinks].forEach(t => t.classList.remove('active'));
    [chatList, reqList, linksList].forEach(l => l.style.display = 'none');
    activeTab.classList.add('active');
    activeList.style.display = 'block';
}

tabUsers.onclick = () => switchTab(tabUsers, chatList);
tabRequests.onclick = () => switchTab(tabRequests, reqList);
if (tabLinks) tabLinks.onclick = () => switchTab(tabLinks, linksList);

function loadPendingRequests() {
    const q = query(collection(db, "requests"), where("receiverId", "==", currentUser.uid), where("status", "==", "pending"));
    onSnapshot(q, async (snapshot) => {
        const reqBadge = document.getElementById('req-badge');
        reqList.innerHTML = '';
        let count = 0;
        for (const docSnap of snapshot.docs) {
            count++;
            const senderSnap = await getDocs(query(collection(db, "users"), where("uid", "==", docSnap.data().senderId)));
            let senderEmail = senderSnap.empty ? "Unknown" : senderSnap.docs[0].data().email;
            const userName = senderEmail.split('@')[0];
            const avatarColor = getAvatarColor(userName);
            const avatarLetter = userName.charAt(0).toUpperCase();

            const div = document.createElement('div');
            div.className = 'chat-item';
            div.innerHTML = `
                <div class="letter-avatar" style="background: ${avatarColor};">${avatarLetter}</div>
                <div class="chat-details" style="flex: 1;">
                    <strong style="color: var(--text-color);">${userName}</strong>
                    <span style="font-size: 12px; color: var(--sub-text);">wants to connect</span>
                </div>
                <div class="req-actions">
                    <button class="btn-accept" style="background:#4caf50; color:white; border:none; padding:8px 12px; border-radius:5px; margin-right:5px; cursor:pointer;" onclick="acceptRequest('${docSnap.id}')">✓</button>
                    <button class="btn-reject" style="background:#f44336; color:white; border:none; padding:8px 12px; border-radius:5px; cursor:pointer;" onclick="rejectRequest('${docSnap.id}')">✕</button>
                </div>
            `;
            reqList.appendChild(div);
        }
        if(count > 0) { reqBadge.style.display = 'inline-block'; reqBadge.innerText = count; } 
        else { reqBadge.style.display = 'none'; reqList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--sub-text);">No pending requests</div>'; }
    });
}

window.acceptRequest = async (reqId) => { await updateDoc(doc(db, "requests", reqId), { status: "accepted" }); showToast("Request accepted!", "success"); };
window.rejectRequest = async (reqId) => { await updateDoc(doc(db, "requests", reqId), { status: "rejected" }); };

window.startCall = function(callType) {
    if (myBlockedUsers.includes(activeChatUser.uid) || isBlockedByThem(activeChatUser.uid)) {
        return showToast("Cannot place call.", "error");
    }
    const appID = 712296497; 
    const serverSecret = "91cd1a3185b235ee0b333ae6a0d99772";
    if (!appID) return showToast("ZegoCloud credentials missing", "error");

    const roomID = [currentUser.uid, activeChatUser.uid].sort().join('_');
    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(appID, serverSecret, roomID, currentUser.uid, currentUser.email.split('@')[0]);
    const callScreen = document.getElementById('call-screen');
    callScreen.style.display = 'block';

    const zp = ZegoUIKitPrebuilt.create(kitToken);
    zp.joinRoom({
        container: callScreen,
        scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
        turnOnCameraWhenJoining: callType === 'video',
        showScreenSharingButton: false,
        onLeaveRoom: () => { callScreen.style.display = 'none'; callScreen.innerHTML = ''; }
    });
};
document.getElementById('video-call-btn').onclick = () => { if(activeChatUser) window.startCall('video'); };
document.getElementById('audio-call-btn').onclick = () => { if(activeChatUser) window.startCall('audio'); };

function getSmartMediaFormat(url) {
    const lowerUrl = url.toLowerCase(); const cleanUrl = lowerUrl.split('?')[0].split('#')[0];
    if (lowerUrl.includes('google.com/imgres')) { try { const searchParams = new URL(url).searchParams; const actualImgUrl = searchParams.get('imgurl'); if (actualImgUrl) return { type: 'image', src: actualImgUrl }; } catch (e) {} }
    if (cleanUrl.match(/\.(mp4|webm|ogg|mov|m4v)$/i) || lowerUrl.includes('blob:')) return { type: 'video', src: url };
    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const ytMatch = url.match(ytRegex); if (ytMatch && ytMatch[1]) return { type: 'youtube', src: `https://www.youtube.com/embed/${ytMatch[1]}` };
    if (lowerUrl.includes('instagram.com/p/') || lowerUrl.includes('instagram.com/reel/') || lowerUrl.includes('instagram.com/tv/')) return { type: 'iframe', src: `${url.split('?')[0].replace(/\/$/, "")}/embed` };
    if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.watch') || lowerUrl.includes('fb.com')) return { type: 'iframe', src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&width=400` };
    const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/); if (driveMatch) return { type: 'iframe', src: `https://drive.google.com/file/d/${driveMatch[1]}/preview` };
    if (cleanUrl.match(/\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i) || lowerUrl.startsWith('data:image')) return { type: 'image', src: url };
    return { type: 'unknown', src: url };
}

const addLinkBtn = document.getElementById('add-link-btn');
const imageUrlInput = document.getElementById('image-url-input');
const imageGallery = document.getElementById('image-gallery');
let globalLinksUnsubscribe = null;

if (addLinkBtn && imageUrlInput && imageGallery) {
    addLinkBtn.onclick = async () => {
        const url = imageUrlInput.value.trim(); if (!url) return showToast("Please paste a link first!", "error");
        addLinkBtn.innerText = "Adding...";
        try { await addDoc(collection(db, "global_links"), { url: url, senderId: currentUser.uid, timestamp: serverTimestamp() }); imageUrlInput.value = ""; showToast("Added to global feed!", "success"); } catch (error) { showToast("Failed to add link.", "error"); }
        addLinkBtn.innerText = "Add";
    };
}

window.loadGlobalLinks = function() {
    if (globalLinksUnsubscribe) globalLinksUnsubscribe();
    const q = query(collection(db, "global_links"), orderBy("timestamp", "desc"));
    globalLinksUnsubscribe = onSnapshot(q, (snapshot) => {
        if (!imageGallery) return; imageGallery.innerHTML = ''; 
        if (snapshot.empty) { imageGallery.innerHTML = '<p style="text-align:center; color:var(--sub-text); font-size:14px; margin-top:20px;">No links added yet.</p>'; return; }
        snapshot.forEach(docSnap => renderMediaCard(docSnap.data(), docSnap.id));
    });
};

function renderMediaCard(data, docId) {
    const url = data.url; let senderName = "Unknown";
    if (typeof allUsersList !== 'undefined') { const senderObj = allUsersList.find(u => u.uid === data.senderId); if (senderObj) senderName = senderObj.email.split('@')[0]; }
    if(data.senderId === currentUser.uid) senderName = "You";
    const avatarColor = getAvatarColor(senderName); const avatarLetter = senderName.charAt(0).toUpperCase();
    const reactions = data.reactions || { like: [], heart: [], dislike: [] }; const comments = data.comments || [];

    const mediaContainer = document.createElement('div'); mediaContainer.className = 'added-image-container';
    const headerDiv = document.createElement('div'); headerDiv.style.display = 'flex'; headerDiv.style.alignItems = 'center'; headerDiv.style.marginBottom = '12px';
    headerDiv.innerHTML = `<div style="width: 35px; height: 35px; border-radius: 50%; background: ${avatarColor}; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 16px; margin-right: 10px;">${avatarLetter}</div><div style="flex: 1;"><strong style="color: var(--text-color); font-size: 14px;">${senderName}</strong><div style="font-size: 11px; color: var(--sub-text);">Shared a link</div></div>`;
    mediaContainer.appendChild(headerDiv);

    if (data.senderId === currentUser.uid) {
        const deleteBtn = document.createElement('button'); deleteBtn.innerHTML = '✕'; deleteBtn.style.position = 'absolute'; deleteBtn.style.top = '15px'; deleteBtn.style.right = '15px';
        deleteBtn.style.background = '#ff4d4d'; deleteBtn.style.color = 'white'; deleteBtn.style.border = 'none'; deleteBtn.style.borderRadius = '50%'; deleteBtn.style.width = '26px'; deleteBtn.style.height = '26px'; deleteBtn.style.cursor = 'pointer'; deleteBtn.style.fontWeight = 'bold'; deleteBtn.style.zIndex = '10';
        deleteBtn.onclick = async () => { try { await deleteDoc(doc(db, "global_links", docId)); showToast("Link deleted", "info"); } catch(e) {} }; mediaContainer.appendChild(deleteBtn);
    }

    const contentBox = document.createElement('div'); contentBox.style.borderRadius = '8px'; contentBox.style.overflow = 'hidden'; contentBox.style.minHeight = '150px'; contentBox.style.background = 'var(--hover-bg)'; contentBox.style.position = 'relative';
    const mediaFormat = getSmartMediaFormat(url);

    const applyZoomEffect = (imgElement, imgSrc) => {
        imgElement.onclick = () => {
            const overlay = document.createElement('div'); overlay.style.position = 'fixed'; overlay.style.top = '0'; overlay.style.left = '0'; overlay.style.width = '100vw'; overlay.style.height = '100vh'; overlay.style.backgroundColor = 'rgba(0,0,0,0.85)'; overlay.style.zIndex = '999999'; overlay.style.display = 'flex'; overlay.style.justifyContent = 'center'; overlay.style.alignItems = 'center'; overlay.style.cursor = 'zoom-out';
            const zoomedImg = document.createElement('img'); zoomedImg.src = imgSrc; zoomedImg.style.maxWidth = '90%'; zoomedImg.style.maxHeight = '90%'; zoomedImg.style.borderRadius = '10px';
            overlay.onclick = () => overlay.remove(); overlay.appendChild(zoomedImg); document.body.appendChild(overlay);
        };
    };

    if (mediaFormat.type === 'video') {
        const videoTag = document.createElement('video'); videoTag.src = mediaFormat.src; videoTag.controls = true; videoTag.style.width = '100%'; videoTag.style.display = 'block'; contentBox.appendChild(videoTag);
    } else if (mediaFormat.type === 'youtube' || mediaFormat.type === 'iframe') {
        const iframe = document.createElement('iframe'); iframe.src = mediaFormat.src; iframe.style.width = '100%'; iframe.style.height = '280px'; iframe.frameBorder = '0'; iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"); iframe.allowFullscreen = true; iframe.style.display = 'block'; contentBox.appendChild(iframe);
    } else if (mediaFormat.type === 'image') {
        const imgTag = document.createElement('img'); imgTag.src = url; imgTag.style.width = '100%'; imgTag.style.display = 'block'; imgTag.style.cursor = 'zoom-in'; 
        imgTag.onload = () => { applyZoomEffect(imgTag, url); };
        imgTag.onerror = () => {
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
            contentBox.innerHTML = `<div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); text-align:center; color:var(--sub-text); font-size:12px; width:100%; z-index:0;">Loading via Proxy...</div><iframe src="${proxyUrl}" style="width:100%; height:400px; border:none; position:relative; z-index:1; background:transparent;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-downloads allow-popups allow-popups-to-escape-sandbox"></iframe>`;
        };
        contentBox.appendChild(imgTag);
    } else {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        contentBox.innerHTML = `<div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); text-align:center; color:var(--sub-text); font-size:12px; width:100%; z-index:0;">Loading Web View via Proxy...</div><iframe src="${proxyUrl}" style="width:100%; height:400px; border:none; position:relative; z-index:1; background:#ffffff;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-downloads allow-popups allow-popups-to-escape-sandbox"></iframe>`;
    }

    mediaContainer.appendChild(contentBox);

    const toggleReaction = async (type) => {
        let updatedReactions = { ...reactions }; const hasReacted = updatedReactions[type].includes(currentUser.uid);
        if (hasReacted) { updatedReactions[type] = updatedReactions[type].filter(id => id !== currentUser.uid); } else { updatedReactions[type].push(currentUser.uid); }
        try { await updateDoc(doc(db, "global_links", docId), { reactions: updatedReactions }); } catch (error) { showToast("Error updating reaction", "error"); }
    };

    const reactionBar = document.createElement('div'); reactionBar.style.display = 'flex'; reactionBar.style.gap = '15px'; reactionBar.style.padding = '12px 0'; reactionBar.style.borderBottom = '1px solid var(--border-color)'; reactionBar.style.marginTop = '10px';
    const createReactionBtn = (emoji, type, array) => {
        const btn = document.createElement('button'); const count = array ? array.length : 0; const isActive = array && array.includes(currentUser.uid);
        btn.innerHTML = `${emoji} <span style="font-size:14px; margin-left:4px;">${count}</span>`; btn.style.background = isActive ? 'rgba(0, 168, 132, 0.1)' : 'transparent'; btn.style.border = isActive ? '1px solid var(--primary-color)' : '1px solid var(--border-color)'; btn.style.borderRadius = '20px'; btn.style.padding = '6px 12px'; btn.style.cursor = 'pointer'; btn.style.display = 'flex'; btn.style.alignItems = 'center'; btn.style.color = 'var(--text-color)';
        btn.onclick = () => toggleReaction(type); return btn;
    };
    reactionBar.appendChild(createReactionBtn('👍', 'like', reactions.like)); reactionBar.appendChild(createReactionBtn('❤️', 'heart', reactions.heart)); reactionBar.appendChild(createReactionBtn('👎', 'dislike', reactions.dislike)); mediaContainer.appendChild(reactionBar);

    const commentSection = document.createElement('div'); commentSection.style.marginTop = '15px';
    const commentList = document.createElement('div'); commentList.style.maxHeight = '150px'; commentList.style.overflowY = 'auto'; commentList.style.marginBottom = '10px';
    comments.forEach(c => {
        const cDiv = document.createElement('div'); cDiv.style.background = 'var(--hover-bg)'; cDiv.style.padding = '8px 12px'; cDiv.style.borderRadius = '8px'; cDiv.style.marginBottom = '6px'; cDiv.style.fontSize = '13px'; cDiv.style.color = 'var(--text-color)'; cDiv.innerHTML = `<strong style="color: var(--primary-color);">${c.userName}:</strong> <span>${c.text}</span>`; commentList.appendChild(cDiv);
    });
    if(comments.length === 0) { const noCmt = document.createElement('div'); noCmt.style.fontSize = '12px'; noCmt.style.color = 'var(--sub-text)'; noCmt.style.marginBottom = '10px'; noCmt.style.textAlign = 'center'; noCmt.innerText = "Be the first to comment!"; commentList.appendChild(noCmt); }
    commentSection.appendChild(commentList);

    const addCommentBox = document.createElement('div'); addCommentBox.style.display = 'flex'; addCommentBox.style.gap = '8px';
    const cInput = document.createElement('input'); cInput.type = 'text'; cInput.placeholder = 'Add a comment...'; cInput.style.flex = '1'; cInput.style.padding = '10px 15px'; cInput.style.borderRadius = '25px'; cInput.style.outline = 'none';
const cBtn = document.createElement('button'); cBtn.innerText = 'Post'; cBtn.style.background = '#00a884'; cBtn.style.color = 'white'; cBtn.style.border = 'none'; cBtn.style.padding = '0 18px'; cBtn.style.borderRadius = '25px'; cBtn.style.cursor = 'pointer'; cBtn.style.fontWeight = 'bold';    cBtn.onclick = async () => {
        const text = cInput.value.trim(); if (!text) return; cBtn.innerText = '...'; cBtn.disabled = true;
        const myName = currentUser.email.split('@')[0]; const newComment = { userId: currentUser.uid, userName: myName, text: text };
        try { await updateDoc(doc(db, "global_links", docId), { comments: arrayUnion(newComment) }); cInput.value = ''; } catch (error) { showToast("Failed to post comment", "error"); }
    };
    cInput.addEventListener("keypress", function(event) { if (event.key === "Enter") { event.preventDefault(); cBtn.click(); } });
    addCommentBox.appendChild(cInput); addCommentBox.appendChild(cBtn); commentSection.appendChild(addCommentBox); mediaContainer.appendChild(commentSection); imageGallery.appendChild(mediaContainer);
}