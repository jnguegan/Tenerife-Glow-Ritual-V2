function getDb() {
  if (!window.supabaseClient) {
    throw new Error("Supabase client not initialized.");
  }
  return window.supabaseClient;
}

async function signUpNew(email, password, fullName) {
  try {
    const db = getDb();

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
      daily_minutes: parseInt(dailyMinutes, 10) || 0
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

    function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
    
    const completedDates = (data || []).map((r) => r.completed_date);
    const daysCompleted = completedDates.length;

    const completedSet = new Set(completedDates);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
   const todayStr = formatLocalDate(today);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatLocalDate(yesterday);

    let streak = 0;

    // 🔥 STRICT RULE:
    // If user didn't complete today or yesterday → streak = 0
    if (completedSet.has(todayStr) || completedSet.has(yesterdayStr)) {
      const check = completedSet.has(todayStr)
        ? new Date(today)
        : new Date(yesterday);

      while (true) {
       const checkStr = formatLocalDate(check);

        if (completedSet.has(checkStr)) {
          streak++;
          check.setDate(check.getDate() - 1);
        } else {
          break;
        }
      }
    }

    return {
      daysCompleted,
      streak,
      completedDates
    };
  } catch (err) {
    console.error("Stats error:", err);
    return null;
  }
}
async function requireAuthNew(redirectTo = "login.html") {
  const session = await getSessionNew();

  if (!session) {
    window.location.href = redirectTo;
    return null;
  }

  return session;
}

async function syncRewardsNew() {
  try {
    const db = getDb();
    const session = await getSessionNew();

    if (!session) {
      return { ok: false, error: "No active session." };
    }

    const stats = await getRitualStatsNew();
    if (!stats) {
      return { ok: false, error: "Could not load ritual stats." };
    }

    const totalDays = stats.streak || 0;

    const { data: rewards, error: rewardsError } = await db
      .from("rewards_catalog")
      .select("*")
      .eq("is_active", true)
      .order("days_required", { ascending: true });

    if (rewardsError) {
      return { ok: false, error: rewardsError.message };
    }

    for (const reward of rewards || []) {
      if (totalDays >= reward.days_required) {
        const { error: upsertError } = await db
          .from("user_rewards")
          .upsert(
            {
              user_id: session.user.id,
              reward_id: reward.id,
              earned_at: new Date().toISOString(),
              claimed: false
            },
            { onConflict: "user_id,reward_id" }
          );

        if (upsertError) {
          console.error("Reward sync error:", upsertError.message);
        }
      }
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function getRewardsNew() {
  try {
    const db = getDb();
    const session = await getSessionNew();

    if (!session) {
      return [];
    }

    const stats = await getRitualStatsNew();
    const totalDays = stats?.streak || 0;

    const { data: rewards, error: rewardsError } = await db
      .from("rewards_catalog")
      .select("*")
      .eq("is_active", true)
      .order("days_required", { ascending: true });

    if (rewardsError) {
      console.error("Rewards catalog error:", rewardsError.message);
      return [];
    }

    const { data: earnedRows, error: earnedError } = await db
      .from("user_rewards")
      .select("*")
      .eq("user_id", session.user.id);

    if (earnedError) {
      console.error("User rewards error:", earnedError.message);
      return [];
    }

    const earnedMap = new Map();
    for (const row of earnedRows || []) {
      earnedMap.set(row.reward_id, row);
    }

    return (rewards || []).map((reward) => {
      const earnedRow = earnedMap.get(reward.id);

      let status = "locked";
      if (earnedRow && earnedRow.claimed) {
        status = "claimed";
      } else if (earnedRow) {
        status = "earned";
      }

      return {
        ...reward,
        status,
        user_reward_id: earnedRow?.id || null,
        claimed: earnedRow?.claimed || false,
        earned_at: earnedRow?.earned_at || null,
        claimed_at: earnedRow?.claimed_at || null,
        progress_days: totalDays
      };
    });
  } catch (err) {
    console.error("Get rewards error:", err);
    return [];
  }
}

async function claimRewardNew(rewardId) {
  try {
    const db = getDb();
    const session = await getSessionNew();

    if (!session) {
      return { ok: false, error: "No active session." };
    }

    const { data, error } = await db
      .from("user_rewards")
      .update({
        claimed: true,
        claimed_at: new Date().toISOString()
      })
      .eq("user_id", session.user.id)
      .eq("reward_id", rewardId)
      .eq("claimed", false)
      .select()
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
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
  getRitualStatsNew,
  requireAuthNew,
  syncRewardsNew,
  getRewardsNew,
  claimRewardNew
};
