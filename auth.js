const db = window.supabaseClient;

function signUpNew(email, password, fullName) {
  db.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  }).then(({ data, error }) => {
    if (error) {
      console.error("Signup error:", error.message);
      return;
    }
    if (data?.user) {
      // Create user profile in background (don't wait)
      db.from("users_simple").insert({
        id: data.user.id,
        email: email,
        full_name: fullName
      }).catch(err => console.error("Profile error:", err));
      
      // Redirect immediately
      setTimeout(() => {
        window.location.href = "profile.html";
      }, 300);
    }
  }).catch(err => {
    console.error("Signup catch error:", err);
  });
  
  // Return immediately without waiting
  return { ok: true };
}

function logInNew(email, password) {
  db.auth.signInWithPassword({ email, password }).then(({ data, error }) => {
    if (error) {
      console.error("Login error:", error.message);
      return;
    }
    if (data?.user) {
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 300);
    }
  }).catch(err => {
    console.error("Login error:", err);
  });
  
  return { ok: true };
}

function logOutNew() {
  localStorage.removeItem("tgr-language");
  localStorage.clear();
  db.auth.signOut().catch(err => console.error("SignOut error:", err));
  
  setTimeout(() => {
    window.location.href = "index.html";
  }, 100);
}

function getSessionNew() {
  return db.auth.getSession().then(({ data: { session } }) => {
    return session;
  });
}

function updateProfileNew(fullName, skinType, goal) {
  return getSessionNew().then(session => {
    if (!session) return { ok: false };
    
    return db.from("users_simple").update({
      full_name: fullName,
      skin_type: skinType,
      goal: goal
    }).eq("id", session.user.id).then(({ error }) => {
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    });
  });
}

function completeRitualNew() {
  return getSessionNew().then(session => {
    if (!session) return { ok: false };
    
    const today = new Date().toISOString().split("T")[0];
    
    db.from("ritual_tracking").upsert({
      user_id: session.user.id,
      completed_date: today,
      completed_at: new Date().toISOString()
    }, { onConflict: "user_id,completed_date" }).catch(err => console.error("Ritual error:", err));
    
    sendCompletionEmail(session.user.email, session.user.user_metadata?.full_name || "User");
    
    return { ok: true };
  });
}

function sendCompletionEmail(email, name) {
  db.functions.invoke('send-email', {
    body: { email, name, type: 'completion' }
  }).catch(err => console.error("Email error:", err));
}

function getUserProfileNew() {
  return getSessionNew().then(session => {
    if (!session) return null;
    
    return db.from("users_simple").select("*").eq("id", session.user.id).single().then(({ data }) => {
      return data;
    });
  });
}

function getRitualStatsNew() {
  return getSessionNew().then(session => {
    if (!session) return null;
    
    return db.from("ritual_tracking").select("completed_date").eq("user_id", session.user.id).then(({ data }) => {
      const completedDates = (data || []).map(r => r.completed_date);
      const daysCompleted = completedDates.length;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let streak = 0;
      let check = new Date(today);
      
      for (const dateStr of completedDates.sort((a, b) => new Date(b) - new Date(a))) {
        const d = new Date(dateStr);
        d.setHours(0, 0, 0, 0);
        if (d.getTime() === check.getTime()) {
          streak++;
          check.setDate(check.getDate() - 1);
        } else {
          break;
        }
      }
      
      return { daysCompleted, streak, completedDates };
    });
  });
}

window.tgrNew = {
  signUpNew,
  logInNew,
  logOutNew,
  getSessionNew,
  updateProfileNew,
  completeRitualNew,
  getUserProfileNew,
  getRitualStatsNew
};
