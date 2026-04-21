function getDb() {
  if (!window.supabaseClient) {
    throw new Error("Supabase client not initialized.");
  }
  return window.supabaseClient;
}

const db = window.supabaseClient;
async function signUpNew(email, password, fullName) {
  try {
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data?.user) {
      return { ok: false, error: "No user created" };
    }

    const { error: profileError } = await db.from("users_simple").upsert({
      id: data.user.id,
      email: email,
      full_name: fullName
    });

    if (profileError) {
      return { ok: false, error: profileError.message };
    }

    const { error: loginError } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (loginError) {
      return { ok: false, error: loginError.message };
    }

    return { ok: true, user: data.user };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function logInNew(email, password) {
  try {
    const db = getDb();

    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    if (!data?.user) {
      return { ok: false, error: "No user returned." };
    }

    return { ok: true, user: data.user };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function logOutNew() {
  try {
    const db = getDb();
    localStorage.removeItem("tgr-language");
    await db.auth.signOut();
    window.location.href = "index.html";
  } catch (err) {
    console.error("Logout error:", err);
    window.location.href = "index.html";
  }
}

async function getSessionNew() {
  try {
    const db = getDb();
    const {
      data: { session }
    } = await db.auth.getSession();
    return session;
  } catch (err) {
    console.error("Session error:", err);
    return null;
  }
}

async function updateProfileNew(fullName, skinType, goal, dailyMinutes) {
  try {
    const db = getDb();
    const session = await getSessionNew();

    if (!session) {
      return { ok: false, error: "No active session." };
    }

    const { error } = await db.from("users_simple").upsert({
      id: session.user.id,
      email: session.user.email,
      full_name: fullName,
      skin_type: skinType,
      goal: goal,
      daily_minutes: parseInt(dailyMinutes, 10)
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function completeRitualNew() {
  try {
    const db = getDb();
    const session = await getSessionNew();

    if (!session) {
      return { ok: false, error: "No active session." };
    }

    const today = new Date().toISOString().split("T")[0];

    const { error } = await db.from("ritual_tracking").upsert(
      {
        user_id: session.user.id,
        completed_date: today,
        completed_at: new Date().toISOString()
      },
      { onConflict: "user_id,completed_date" }
    );

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function getUserProfileNew() {
  try {
    const db = getDb();
    const session = await getSessionNew();

    if (!session) {
      return null;
    }

    const { data, error } = await db
      .from("users_simple")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (error) {
      console.error("Profile fetch error:", error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Profile error:", err);
    return null;
  }
}

async function getRitualStatsNew() {
  try {
    const db = getDb();
    const session = await getSessionNew();

    if (!session) {
      return null;
    }

    const { data, error } = await db
      .from("ritual_tracking")
      .select("completed_date")
      .eq("user_id", session.user.id)
      .order("completed_date", { ascending: false });

    if (error) {
      console.error("Stats fetch error:", error.message);
      return null;
    }

    const completedDates = (data || []).map((r) => r.completed_date);
    const daysCompleted = completedDates.length;

    let streak = 0;
    const check = new Date();
    check.setHours(0, 0, 0, 0);

    for (const dateStr of completedDates) {
      const d = new Date(dateStr);
      d.setHours(0, 0, 0, 0);

      if (d.getTime() === check.getTime()) {
        streak++;
        check.setDate(check.getDate() - 1);
      } else if (d.getTime() < check.getTime()) {
        break;
      }
    }

    return { daysCompleted, streak, completedDates };
  } catch (err) {
    console.error("Stats error:", err);
    return null;
  }
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
