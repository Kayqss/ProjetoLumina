import React, { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header";
import EditIcon from "../assets/icons/EditIcon.svg";
import HomemIcon from "../assets/icons/HomemIcon.svg";
import MulherIcon from "../assets/icons/MulherIcon.svg";
import LixeiraIcon from "../assets/icons/LixeiraIcon.svg";
import SaveIcon from "../assets/icons/SaveIcon.svg";
import "./PerfilPaciente.css";
import { fetchWithOperator } from "../utils/operator";

const generateLocalId = () =>
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createEquivalent = (equivalent = {}) => ({
  id:
    typeof equivalent.id === "string" && equivalent.id
      ? equivalent.id
      : generateLocalId(),
  name: typeof equivalent.name === "string" ? equivalent.name : "",
  quantity:
    equivalent.quantity !== undefined && equivalent.quantity !== null
      ? String(equivalent.quantity)
      : "",
});

const createFood = (food = {}) => ({
  id: typeof food.id === "string" && food.id ? food.id : generateLocalId(),
  name: typeof food.name === "string" ? food.name : "",
  quantity:
    food.quantity !== undefined && food.quantity !== null
      ? String(food.quantity)
      : "",
  equivalents: Array.isArray(food.equivalents)
    ? food.equivalents.map(createEquivalent)
    : [],
});

const createMeal = (meal = {}) => ({
  id: typeof meal.id === "string" && meal.id ? meal.id : generateLocalId(),
  time: typeof meal.time === "string" && meal.time ? meal.time : "08:00",
  title:
    typeof meal.title === "string" && meal.title ? meal.title : "Nova refeição",
  note: typeof meal.note === "string" ? meal.note : "",
  energy:
    meal.energy !== undefined && meal.energy !== null
      ? String(meal.energy)
      : "",
  fat: meal.fat !== undefined && meal.fat !== null ? String(meal.fat) : "",
  carbs:
    meal.carbs !== undefined && meal.carbs !== null ? String(meal.carbs) : "",
  protein:
    meal.protein !== undefined && meal.protein !== null
      ? String(meal.protein)
      : "",
  fiber:
    meal.fiber !== undefined && meal.fiber !== null ? String(meal.fiber) : "",
  foods: Array.isArray(meal.foods) ? meal.foods.map(createFood) : [],
});

const hydrateMeals = (rawMeals) =>
  Array.isArray(rawMeals)
    ? rawMeals.map((meal) => ({
        ...createMeal(meal),
        hasChanges: false,
        isSaving: false,
      }))
    : [];

const serializeMeals = (meals) =>
  Array.isArray(meals)
    ? meals.map((meal) => {
        const base = createMeal(meal);
        return {
          id: base.id,
          time: base.time,
          title: base.title,
          note: base.note,
          energy: base.energy,
          fat: base.fat,
          carbs: base.carbs,
          protein: base.protein,
          fiber: base.fiber,
          foods: base.foods.map((food) => ({
            id: food.id,
            name: food.name,
            quantity: food.quantity,
            equivalents: food.equivalents.map((eq) => ({
              id: eq.id,
              name: eq.name,
              quantity: eq.quantity,
            })),
          })),
        };
      })
    : [];

const MACRO_TARGETS = {
  fat: "",
  carbs: "",
  protein: "",
  fiber: "",
};

const MACRO_ENTRIES = [
  { key: "fat", label: "Lipideos", color: "#F2C94C", background: "#FFF6CC" },
  {
    key: "carbs",
    label: "Carboidratos",
    color: "#F2994A",
    background: "#FDE4D0",
  },
  {
    key: "protein",
    label: "Proteinas",
    color: "#56CCF2",
    background: "#DBF3FF",
  },
  {
    key: "fiber",
    label: "Fibra alimentar",
    color: "#27AE60",
    background: "#D9F5E6",
  },
];

const MACRO_KEYS = MACRO_ENTRIES.map((entry) => entry.key);
const DEFAULT_MACRO_TARGET_INPUTS = MACRO_KEYS.reduce((acc, key) => {
  acc[key] = String(MACRO_TARGETS[key] ?? "");
  return acc;
}, {});

const sanitizeMacroTargetsResponse = (value) => {
  const base = { ...DEFAULT_MACRO_TARGET_INPUTS };
  if (value && typeof value === "object") {
    MACRO_KEYS.forEach((key) => {
      if (value[key] !== undefined && value[key] !== null) {
        base[key] = String(value[key]);
      }
    });
  }
  return base;
};

const buildMacroTargetsPayload = (inputs) => {
  const payload = {};
  MACRO_KEYS.forEach((key) => {
    const raw = inputs?.[key];
    payload[key] = raw == null ? "" : String(raw);
  });
  return payload;
};

const parseMacroValue = (value) => {
  if (value === null || value === undefined) return 0;
  const normalized = String(value).replace(",", ".").trim();
  if (!normalized) return 0;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumericValue = (value, fractionDigits = 1) =>
  Number.isFinite(value) ? value.toFixed(fractionDigits) : "0.0";
function PerfilPaciente() {
  const navigate = useNavigate();
  const location = useLocation();
  const paciente = location.state?.paciente;
  const { id: idParam } = useParams();
  const [full, setFull] = useState(null);
  const [lastEval, setLastEval] = useState(null);
  const [evals, setEvals] = useState([]);
  const [selectedEvalId, setSelectedEvalId] = useState(null);
  const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
  const routeId = Number(idParam) || paciente?.id || null;
  // Estados de texto das se��es + refs para edi��o
  const [histClinico, setHistClinico] = useState(
    paciente?.historicoClinico || ""
  );
  const [medicacoes, setMedicacoes] = useState(
    (full?.medicacoes ?? paciente?.medicacoes) || ""
  );
  const [alergias, setAlergias] = useState(paciente?.alergias || "");
  const [anotacoes, setAnotacoes] = useState(paciente?.anotacoes || "");
  const [reviewIA, setReviewIA] = useState(paciente?.ultimaReviewIA || "");
  const [meals, setMeals] = useState([]);
  const [planSyncError, setPlanSyncError] = useState("");
  const [planSaving, setPlanSaving] = useState(false);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [hasPendingPlanChanges, setHasPendingPlanChanges] = useState(false);
  const planLoadedRef = useRef(false);
  const planDirtyRef = useRef(false);
  const planRevisionRef = useRef(0);
  const planSaveTimerRef = useRef(null);
  const planSaveInFlightRef = useRef(false);
  const planSavePendingRef = useRef(false);
  const planSavePendingDelayRef = useRef(0);
  const mealsRef = useRef([]);
  const [macroTargetInputs, setMacroTargetInputs] = useState(() => ({
    ...DEFAULT_MACRO_TARGET_INPUTS,
  }));
  const macroTargetInputsRef = useRef({ ...DEFAULT_MACRO_TARGET_INPUTS });

  useEffect(() => {
    if (full?.ultimaReviewIA !== undefined) {
      setReviewIA(full.ultimaReviewIA || "");
    }
  }, [full?.ultimaReviewIA]);

  const applyMacroTargetInputs = (value) => {
    const sanitized = sanitizeMacroTargetsResponse(value);
    macroTargetInputsRef.current = sanitized;
    setMacroTargetInputs(sanitized);
  };

  const macroTargets = useMemo(() => {
    const result = {};
    MACRO_ENTRIES.forEach(({ key }) => {
      result[key] = parseMacroValue(macroTargetInputs[key]);
    });
    return result;
  }, [macroTargetInputs]);
  const macroTotals = useMemo(() => {
    const totals = {
      energy: 0,
      fat: 0,
      carbs: 0,
      protein: 0,
      fiber: 0,
    };

    meals.forEach((meal) => {
      totals.energy += parseMacroValue(meal?.energy);
      totals.fat += parseMacroValue(meal?.fat);
      totals.carbs += parseMacroValue(meal?.carbs);
      totals.protein += parseMacroValue(meal?.protein);
      totals.fiber += parseMacroValue(meal?.fiber);
    });

    return totals;
  }, [meals]);

  const handleMacroTargetChange = (key) => (event) => {
    const { value } = event.target;
    const next = { ...macroTargetInputsRef.current, [key]: value };
    applyMacroTargetInputs(next);
    planRevisionRef.current += 1;
    planDirtyRef.current = true;
    setHasPendingPlanChanges(true);
    setPlanSyncError("");
    schedulePlanSave(500);
  };

  const handleClearMacroTargets = () => {
    applyMacroTargetInputs(DEFAULT_MACRO_TARGET_INPUTS);
    planRevisionRef.current += 1;
    planDirtyRef.current = true;
    setHasPendingPlanChanges(true);
    setPlanSyncError("");
    schedulePlanSave(150, { force: true });
  };

  const macroChart = useMemo(() => {
    const totalMacros = MACRO_ENTRIES.reduce(
      (acc, entry) => acc + macroTotals[entry.key],
      0
    );
    let currentStart = 0;
    const segments = [];
    const legend = MACRO_ENTRIES.map((entry) => {
      const value = macroTotals[entry.key];
      const percent = totalMacros > 0 ? (value / totalMacros) * 100 : 0;
      if (percent > 0) {
        segments.push({
          color: entry.color,
          start: currentStart,
          end: currentStart + percent,
        });
      }
      currentStart += percent;
      const target = macroTargets[entry.key];
      const ratio = target > 0 ? Math.min(value / target, 1) : 0;
      return {
        key: entry.key,
        label: entry.label,
        color: entry.color,
        background: entry.background,
        value,
        target,
        ratio,
      };
    });

    const gradient =
      segments.length > 0
        ? "conic-gradient(" +
          segments
            .map(
              (segment) =>
                segment.color + " " + segment.start + "% " + segment.end + "%"
            )
            .join(", ") +
          ", #e5e7eb " +
          Math.min(currentStart, 100) +
          "% 100%)"
        : "#e5e7eb";

    return { legend, gradient, totalMacros };
  }, [macroTotals, macroTargets]);

  const totalEnergyDisplay = formatNumericValue(macroTotals.energy, 0);
  const pHistRef = useRef(null);
  const pMedRef = useRef(null);
  const pAlerRef = useRef(null);
  const pAnotRef = useRef(null);
  const pReviewRef = useRef(null);
  useEffect(() => {
    mealsRef.current = meals;
  }, [meals]);

  useEffect(
    () => () => {
      if (planSaveTimerRef.current) {
        clearTimeout(planSaveTimerRef.current);
        planSaveTimerRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (!routeId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetchWithOperator(`${baseUrl}/patients/${routeId}/meal-plan`);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (cancelled) return;
        const hydrated = hydrateMeals(data?.meals);
        setMeals(hydrated);
        mealsRef.current = hydrated;
        applyMacroTargetInputs(data?.macroTargets);
        planDirtyRef.current = false;
        setHasPendingPlanChanges(false);
        setPlanSyncError("");
      } catch (error) {
        console.error(error);
        if (cancelled) return;
        setPlanSyncError(
          "Não foi possível carregar o plano alimentar. Os dados serão sincronizados assim que possível."
        );
      } finally {
        if (!cancelled) {
          planLoadedRef.current = true;
          setPlanLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [routeId, baseUrl]);

  const handleDelete = async () => {
    const id = full?.id ?? paciente?.id ?? routeId;
    if (!id) {
      alert("Não foi possível identificar o paciente.");
      return;
    }

    const ok = window.confirm(
      "Deseja realmente deletar este perfil? Esta ação não pode ser desfeita."
    );
    if (!ok) return;
    try {
      const res = await fetchWithOperator(`${baseUrl}/patients/${id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        throw new Error(String(res.status));
      }

      try {
        localStorage.removeItem(`phones:${id}`);
      } catch {}
      alert("Perfil deletado com sucesso.");
      navigate("/meuspacientes", { replace: true });
    } catch (e) {
      console.error(e);
      alert("Erro ao deletar o perfil. Tente novamente.");
    }
  };
  const savePlanToServer = async ({ force = false } = {}) => {
    if (!routeId) return;
    if (!force && (!planDirtyRef.current || !planLoadedRef.current)) return;

    if (planSaveInFlightRef.current) {
      planSavePendingRef.current = true;
      return;
    }

    const snapshot = mealsRef.current;
    const serialized = serializeMeals(snapshot);
    const savedMealIds = new Set(serialized.map((meal) => meal.id));
    const revisionAtStart = planRevisionRef.current;

    planSaveInFlightRef.current = true;
    setPlanSaving(true);
    setPlanSyncError("");

    setMeals((prev) => {
      let touched = false;
      const next = prev.map((meal) => {
        if (!savedMealIds.has(meal.id) || !meal.hasChanges) return meal;
        touched = true;
        return { ...meal, isSaving: true };
      });
      if (touched) mealsRef.current = next;
      return touched ? next : prev;
    });

    try {
      const res = await fetchWithOperator(`${baseUrl}/patients/${routeId}/meal-plan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meals: serialized,
          macroTargets: buildMacroTargetsPayload(macroTargetInputsRef.current),
        }),
      });
      if (!res.ok) {
        throw new Error(`Failed to save meal plan (${res.status})`);
      }
      const payload = await res.json();
      const serverMeals = hydrateMeals(
        Array.isArray(payload?.meals) ? payload.meals : serialized
      );
      const isStaleResponse = planRevisionRef.current !== revisionAtStart;

      if (!isStaleResponse) {
        setMeals(serverMeals);
        mealsRef.current = serverMeals;
        applyMacroTargetInputs(payload?.macroTargets);
      } else {
        mealsRef.current = serverMeals;
      }

      if (!isStaleResponse && !planSavePendingRef.current) {
        planDirtyRef.current = false;
        setHasPendingPlanChanges(false);
      }
    } catch (error) {
      console.error(error);
      planDirtyRef.current = true;
      setPlanSyncError("Erro ao salvar o plano alimentar. Tente novamente.");
      setMeals((prev) => {
        const next = prev.map((meal) =>
          savedMealIds.has(meal.id) ? { ...meal, isSaving: false } : meal
        );
        mealsRef.current = next;
        return next;
      });
    } finally {
      planSaveInFlightRef.current = false;
      setPlanSaving(false);
      if (planSavePendingRef.current) {
        planSavePendingRef.current = false;
        const delay = planSavePendingDelayRef.current || 400;
        planSavePendingDelayRef.current = 0;
        schedulePlanSave(delay, { force: true, allowWhenSaving: true });
      }
    }
  };

  const schedulePlanSave = (
    delay = 800,
    { force = false, allowWhenSaving = false } = {}
  ) => {
    if (!routeId || !planLoadedRef.current) return;
    if (!force && !planDirtyRef.current) return;

    if (planSaveInFlightRef.current && !allowWhenSaving) {
      planSavePendingRef.current = true;
      planSavePendingDelayRef.current = delay;
      return;
    }

    if (planSaveTimerRef.current) {
      clearTimeout(planSaveTimerRef.current);
    }

    planSaveTimerRef.current = setTimeout(() => {
      planSaveTimerRef.current = null;
      void savePlanToServer({ force });
    }, delay);
  };

  const registerPlanChange = (delay = 800) => {
    planRevisionRef.current += 1;
    planDirtyRef.current = true;
    setHasPendingPlanChanges(true);
    setPlanSyncError("");
    schedulePlanSave(delay);
  };

  const handleAddMeal = () => {
    const newMeal = { ...createMeal(), hasChanges: true, isSaving: false };
    setMeals((prev) => {
      const next = [...prev, newMeal];
      mealsRef.current = next;
      return next;
    });
    registerPlanChange(300);
  };

  const handleRemoveMeal = async (id) => {
    if (!id) return;
    const previousMeals = mealsRef.current || [];
    let removedMeal = null;
    const nextMeals = previousMeals.filter((meal) => {
      if (meal.id === id) {
        removedMeal = meal;
        return false;
      }
      return true;
    });
    if (!removedMeal) return;

    mealsRef.current = nextMeals;
    setMeals(nextMeals);
    setPlanSyncError("");

    if (!routeId) return;

    try {
      const res = await fetchWithOperator(
        `${baseUrl}/patients/${routeId}/meal-plan/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        const data = await res.json();
        const serverMeals = hydrateMeals(
          Array.isArray(data?.meals) ? data.meals : nextMeals
        );
        mealsRef.current = serverMeals;
        setMeals(serverMeals);
        applyMacroTargetInputs(data?.macroTargets);
        planDirtyRef.current = false;
        setHasPendingPlanChanges(false);
        return;
      }

      if (res.status === 404) {
        await savePlanToServer({ force: true });
        return;
      }

      throw new Error(String(res.status));
    } catch (error) {
      console.error(error);
      setPlanSyncError("Não foi possível excluir a refeição. Tente novamente.");
      const restoredMeals = [...nextMeals, removedMeal];
      mealsRef.current = restoredMeals;
      setMeals(restoredMeals);
    }
  };

  const handleSaveMeal = (mealId) => {
    let touched = false;
    if (planSaveTimerRef.current) {
      clearTimeout(planSaveTimerRef.current);
      planSaveTimerRef.current = null;
    }
    setMeals((prev) => {
      const next = prev.map((meal) => {
        if (meal.id !== mealId) return meal;
        touched = true;
        return { ...meal, isSaving: true };
      });
      if (touched) {
        mealsRef.current = next;
      }
      return touched ? next : prev;
    });
    schedulePlanSave(0, { force: true });
  };

  const handleAddFood = (mealId) => {
    let changed = false;
    setMeals((prev) => {
      const next = prev.map((meal) => {
        if (meal.id !== mealId) return meal;
        const safeFoods = Array.isArray(meal.foods) ? meal.foods : [];
        changed = true;
        return {
          ...meal,
          foods: [...safeFoods, createFood()],
          hasChanges: true,
          isSaving: false,
        };
      });
      if (!changed) return prev;
      mealsRef.current = next;
      return next;
    });
    if (changed) {
      registerPlanChange(400);
    }
  };

  const handleRemoveFood = (mealId, foodId) => {
    let changed = false;
    setMeals((prev) => {
      const next = prev.map((meal) => {
        if (meal.id !== mealId) return meal;
        const safeFoods = Array.isArray(meal.foods) ? meal.foods : [];
        let removed = false;
        const filtered = safeFoods.filter((food) => {
          if (food.id === foodId) {
            removed = true;
            return false;
          }
          return true;
        });
        if (!removed) return meal;
        changed = true;
        return {
          ...meal,
          foods: filtered,
          hasChanges: true,
          isSaving: false,
        };
      });
      if (!changed) return prev;
      mealsRef.current = next;
      return next;
    });
    if (changed) {
      registerPlanChange(400);
    }
  };
  const handleFoodFieldChange = (mealId, foodId, field) => (event) => {
    const value = event.target.value;
    let changed = false;
    setMeals((prev) => {
      const next = prev.map((meal) => {
        if (meal.id !== mealId) return meal;
        const safeFoods = Array.isArray(meal.foods) ? meal.foods : [];
        let mealChanged = false;
        const updatedFoods = safeFoods.map((food) => {
          if (food.id !== foodId) return food;
          if (food[field] === value) return food;
          mealChanged = true;
          return { ...food, [field]: value };
        });
        if (!mealChanged) return meal;
        changed = true;
        return {
          ...meal,
          foods: updatedFoods,
          hasChanges: true,
          isSaving: false,
        };
      });
      if (!changed) return prev;
      mealsRef.current = next;
      return next;
    });
    if (changed) {
      registerPlanChange(800);
    }
  };
  const handleAddEquivalent = (mealId, foodId) => {
    let changed = false;
    setMeals((prev) => {
      const next = prev.map((meal) => {
        if (meal.id !== mealId) return meal;
        const safeFoods = Array.isArray(meal.foods) ? meal.foods : [];
        const updatedFoods = safeFoods.map((food) => {
          if (food.id !== foodId) return food;
          const baseEquivalents = Array.isArray(food.equivalents)
            ? food.equivalents
            : [];
          changed = true;
          return {
            ...food,
            equivalents: [...baseEquivalents, createEquivalent()],
          };
        });
        if (!changed) return meal;
        return {
          ...meal,
          foods: updatedFoods,
          hasChanges: true,
          isSaving: false,
        };
      });
      if (!changed) return prev;
      mealsRef.current = next;
      return next;
    });
    if (changed) {
      registerPlanChange(400);
    }
  };
  const handleRemoveEquivalent = (mealId, foodId, equivalentId) => {
    let changed = false;
    setMeals((prev) => {
      const next = prev.map((meal) => {
        if (meal.id !== mealId) return meal;
        const safeFoods = Array.isArray(meal.foods) ? meal.foods : [];
        let mealChanged = false;
        const updatedFoods = safeFoods.map((food) => {
          if (food.id !== foodId) return food;
          const baseEquivalents = Array.isArray(food.equivalents)
            ? food.equivalents
            : [];
          const filtered = baseEquivalents.filter((equivalent) => {
            if (equivalent.id === equivalentId) {
              mealChanged = true;
              return false;
            }
            return true;
          });
          if (!mealChanged) return food;
          return { ...food, equivalents: filtered };
        });
        if (!mealChanged) return meal;
        changed = true;
        return {
          ...meal,
          foods: updatedFoods,
          hasChanges: true,
          isSaving: false,
        };
      });
      if (!changed) return prev;
      mealsRef.current = next;
      return next;
    });
    if (changed) {
      registerPlanChange(400);
    }
  };
  const handleEquivalentFieldChange =
    (mealId, foodId, equivalentId, field) => (event) => {
      const value = event.target.value;
      let changed = false;
      setMeals((prev) => {
        const next = prev.map((meal) => {
          if (meal.id !== mealId) return meal;
          const safeFoods = Array.isArray(meal.foods) ? meal.foods : [];
          let mealChanged = false;
          const updatedFoods = safeFoods.map((food) => {
            if (food.id !== foodId) return food;
            const baseEquivalents = Array.isArray(food.equivalents)
              ? food.equivalents
              : [];
            let foodChanged = false;
            const updatedEquivalents = baseEquivalents.map((equivalent) => {
              if (equivalent.id !== equivalentId) return equivalent;
              if (equivalent[field] === value) return equivalent;
              foodChanged = true;
              return { ...equivalent, [field]: value };
            });
            if (!foodChanged) return food;
            mealChanged = true;
            return { ...food, equivalents: updatedEquivalents };
          });
          if (!mealChanged) return meal;
          changed = true;
          return {
            ...meal,
            foods: updatedFoods,
            hasChanges: true,
            isSaving: false,
          };
        });
        if (!changed) return prev;
        mealsRef.current = next;
        return next;
      });
      if (changed) {
        registerPlanChange(800);
      }
    };
  const handleMealFieldBlur = (id, field) => (event) => {
    const target = event.currentTarget;
    const textContent = (target.textContent ?? "").trim();
    let resolvedValue = textContent;
    let fallbackValue = field === "time" ? "08:00" : "Nova refeição";
    let changed = false;
    setMeals((prev) => {
      const next = prev.map((meal) => {
        if (meal.id !== id) return meal;
        fallbackValue = meal[field] || fallbackValue;
        const nextValue = textContent || fallbackValue;
        resolvedValue = nextValue;
        if (nextValue === meal[field]) return meal;
        changed = true;
        return {
          ...meal,
          [field]: nextValue,
          hasChanges: true,
          isSaving: false,
        };
      });
      if (!changed) return prev;
      mealsRef.current = next;
      return next;
    });
    if (!resolvedValue) {
      resolvedValue = fallbackValue;
    }

    if (target.textContent !== resolvedValue) {
      target.textContent = resolvedValue;
    }
    if (changed) {
      registerPlanChange(400);
    }
  };
  const handleMealNoteChange = (id) => (event) => {
    const value = event.target.value;
    let changed = false;
    setMeals((prev) => {
      const next = prev.map((meal) => {
        if (meal.id !== id) return meal;
        if ((meal.note ?? "") === value) return meal;
        changed = true;
        return {
          ...meal,
          note: value,
          hasChanges: true,
          isSaving: false,
        };
      });
      if (!changed) return prev;
      mealsRef.current = next;
      return next;
    });
    if (changed) {
      registerPlanChange(800);
    }
  };
  const handleMealMacroChange = (id, field) => (event) => {
    const value = event.target.value;
    let changed = false;
    setMeals((prev) => {
      const next = prev.map((meal) => {
        if (meal.id !== id) return meal;
        if ((meal[field] ?? "") === value) return meal;
        changed = true;
        return {
          ...meal,
          [field]: value,
          hasChanges: true,
          isSaving: false,
        };
      });
      if (!changed) return prev;
      mealsRef.current = next;
      return next;
    });
    if (changed) {
      registerPlanChange(800);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return "-";
    const str = String(iso);
    const base = str.includes("T") ? str.split("T")[0] : str;
    const parts = base.split("-");
    if (parts.length === 3) {
      const [y, m, d] = parts;
      if (y && m && d)
        return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
    }

    try {
      const dt = new Date(str);
      if (!Number.isNaN(dt.getTime())) {
        const dd = String(dt.getDate()).padStart(2, "0");
        const mm = String(dt.getMonth() + 1).padStart(2, "0");
        const yy = dt.getFullYear();
        return `${dd}/${mm}/${yy}`;
      }
    } catch {}
    return str;
  };

  // === ADICIONAR DEPOIS DA FUNÇÃO formatDate ===
  const calcularPercentualGordura = (evaluation, genero) => {
    if (!evaluation) return null;

    const generoStr = String(genero || "").toLowerCase();
    const isFem = generoStr.startsWith("f");

    // Jackson-Pollock 3 Dobras
    if (isFem) {
      // Fórmula para mulheres: tríceps, supra-ilíaca e coxa
      const triceps = evaluation.peitoralMm;
      const supraIliaca = evaluation.abdomenMm;
      const coxa = evaluation.coxaMm;

      if (!triceps || !supraIliaca || !coxa) return null;

      const somaDobras = Number(triceps) + Number(supraIliaca) + Number(coxa);
      const densidadeCorporal =
        1.0994921 -
        0.0009929 * somaDobras +
        0.0000023 * Math.pow(somaDobras, 2) -
        0.0001392 * (evaluation.idade || 30);
      const percentualGordura = 495 / densidadeCorporal - 450;

      return percentualGordura > 0 ? percentualGordura : null;
    } else {
      // Fórmula para homens: peitoral, abdominal e coxa
      const peitoral = evaluation.peitoralMm;
      const abdominal = evaluation.abdomenMm;
      const coxa = evaluation.coxaMm;

      if (!peitoral || !abdominal || !coxa) return null;

      const somaDobras = Number(peitoral) + Number(abdominal) + Number(coxa);
      const densidadeCorporal =
        1.10938 -
        0.0008267 * somaDobras +
        0.0000016 * Math.pow(somaDobras, 2) -
        0.0002574 * (evaluation.idade || 30);
      const percentualGordura = 495 / densidadeCorporal - 450;

      return percentualGordura > 0 ? percentualGordura : null;
    }
  };

  // Busca sempre os dados completos do paciente por ID (para garantir campos como 'anotacoes')
  useEffect(() => {
    if (!routeId) return;
    (async () => {
      try {
        const res = await fetchWithOperator(`${baseUrl}/patients/${routeId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data) setFull(data);
      } catch {}
    })();
  }, [routeId]);
  const handleDeleteEvaluation = async () => {
    try {
      const current = evals.find((e) => e?.id === selectedEvalId) || lastEval;
      const id = current?.id;
      if (!id) {
        alert("Nenhuma consulta selecionada.");
        return;
      }

      const ok = window.confirm(
        "Excluir esta consulta? Esta ação não pode ser desfeita."
      );
      if (!ok) return;
      const res = await fetchWithOperator(`${baseUrl}/evaluations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        alert("Não foi possível excluir no servidor.");
        return;
      }

      const updated = evals.filter((e) => e.id !== id);
      setEvals(updated);
      if (updated.length > 0) {
        setLastEval(updated[0]);
        setSelectedEvalId(null);
      } else {
        setLastEval(null);
        setSelectedEvalId(null);
      }

      alert("Consulta excluída com sucesso.");
    } catch (e) {
      console.error(e);
      alert("Erro ao excluir consulta.");
    }
  };
  useEffect(() => {
    if (!routeId) return;
    (async () => {
      try {
        const res = await fetchWithOperator(`${baseUrl}/evaluations/patient/${routeId}`);
        if (!res.ok) return;
        const items = await res.json();
        if (Array.isArray(items)) {
          setEvals(items);
          if (items.length > 0) setLastEval(items[0]);
        }
      } catch {}
    })();
  }, [routeId]);
  // Preenche estados de texto quando detalhes completos chegarem
  useEffect(() => {
    if (!full) return;
    try {
      if (!histClinico) setHistClinico(full.historicoClinico || "");
      if (!medicacoes) setMedicacoes(full.medicacoes || "");
      if (!alergias) setAlergias(full.alergias || "");
      if (!anotacoes && typeof full.anotacoes === "string")
        setAnotacoes(full.anotacoes || "");
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full]);
  // Garante que campos atualizados do backend sejam refletidos mesmo se o state inicial vier desatualizado
  useEffect(() => {
    // Atualiza visualmente o campo "G�nero" usando o valor de `full` (em alguns ambientes de encoding)
    try {
      if (!full?.genero) return;
      const campos = document.querySelectorAll(".perfil-summary .campo");
      campos.forEach((c) => {
        const rotulo = c.querySelector(".rotulo");
        const valor = c.querySelector(".valor");
        const t = rotulo?.textContent?.toLowerCase?.() || "";
        if (
          t.includes("genero") ||
          t.includes("genero") ||
          t.includes("genero")
        ) {
          if (valor) valor.textContent = full.genero || "-";
        }
      });
    } catch {}
  }, [full?.genero]);
  // Atualiza "�ltima consulta" (data da �ltima avalia��o)
  useEffect(() => {
    try {
      const campos = document.querySelectorAll(".perfil-summary .campo");
      campos.forEach((c) => {
        const rotulo = c.querySelector(".rotulo");
        const valor = c.querySelector(".valor");
        const t = rotulo?.textContent?.toLowerCase?.() || "";
        if (
          t.includes("ultima consulta") ||
          t.includes("ultima consulta") ||
          t.includes("ultima consulta")
        ) {
          if (valor)
            valor.textContent = lastEval?.createdAt
              ? formatDate(lastEval.createdAt)
              : "-";
        }
      });
    } catch {}
  }, [lastEval?.createdAt]);
  // (sem save autom�tico por enquanto)
  // sem carregamento via rota com ID; a p�gina usa apenas o state
  const calcAgeYears = (iso) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      const now = new Date();
      let y = now.getFullYear() - d.getFullYear();
      const m = now.getMonth() - d.getMonth();
      const md = now.getDate() - d.getDate();
      if (m < 0 || (m === 0 && md < 0)) y--;
      return y;
    } catch {
      return null;
    }
  };
  const srcNome = full || paciente;
  const nomeCompleto = [srcNome?.nome, srcNome?.sobrenome]
    .filter(Boolean)
    .join(" ");
  // Torna as cinco primeiras se��es edit�veis via contenteditable
  useEffect(() => {
    try {
      const secs = document.querySelectorAll(".perfil-sections .section");
      const idxs = [0, 1, 2, 3];
      idxs.forEach((i) => {
        const sec = secs[i];
        if (!sec) return;
        // sem edi��o autom�tica
      });
    } catch {}
  }, []);
  // Tabs: ao clicar em "Estat�sticas do paciente", destaca a aba e esconde as se��es
  useEffect(() => {
    try {
      const nav = document.querySelector(".perfil-nav");
      const sections = document.querySelector(".perfil-sections");
      const stats = document.querySelector(".perfil-stats");
      const dieta = document.querySelector(".perfil-dieta");
      if (!nav) return;
      const btns = nav.querySelectorAll("button.tab");
      const btnSobre = btns[0];
      const btnStats = btns[1];
      const btnDieta = btns[2];
      if (btnStats) btnStats.disabled = false;
      if (btnDieta) btnDieta.disabled = false;
      const setTab = (tab) => {
        if (btnSobre)
          btnSobre.setAttribute(
            "aria-selected",
            tab === "sobre" ? "true" : "false"
          );
        if (btnStats)
          btnStats.setAttribute(
            "aria-selected",
            tab === "stats" ? "true" : "false"
          );
        if (btnDieta)
          btnDieta.setAttribute(
            "aria-selected",
            tab === "dieta" ? "true" : "false"
          );
        if (sections)
          sections.style.display =
            tab === "stats" || tab === "dieta" ? "none" : "";
        if (stats) stats.style.display = tab === "stats" ? "" : "none";
        if (dieta) dieta.style.display = tab === "dieta" ? "" : "none";
        setActiveTab(tab);
      };
      const onSobre = () => setTab("sobre");
      const onStats = () => setTab("stats");
      const onDieta = () => setTab("dieta");
      btnSobre && btnSobre.addEventListener("click", onSobre);
      btnStats && btnStats.addEventListener("click", onStats);
      btnDieta && btnDieta.addEventListener("click", onDieta);
      // estado inicial: sobre
      setTab("sobre");
      return () => {
        btnSobre && btnSobre.removeEventListener("click", onSobre);
        btnStats && btnStats.removeEventListener("click", onStats);
        btnDieta && btnDieta.removeEventListener("click", onDieta);
      };
    } catch {}
  }, [full]);
  // Habilita edi��o multilinha nas quatro primeiras caixas
  useEffect(() => {
    try {
      const secs = document.querySelectorAll(".perfil-sections .section");
      const idxs = [0, 1, 2, 3];
      idxs.forEach((i) => {
        const sec = secs[i];
        if (!sec) return;
        const p = sec.querySelector("p");
        if (!p) return;
        p.setAttribute("contenteditable", "true");
        p.classList.add("editable-paragraph");
      });
    } catch {}
  }, []);
  // Mostra bot�o "Salvar" quando o conte�do for alterado nas 5 primeiras caixas
  useEffect(() => {
    const id = paciente?.id;
    const secs = document.querySelectorAll(".perfil-sections .section");
    const idxs = [0, 1, 2, 3];
    const pencilCleanups = [];
    idxs.forEach((i) => {
      const sec = secs[i];
      if (!sec) return;
      const p = sec.querySelector("p");
      if (!p) return;
      let original = (p.innerText || "").trim();
      let btn = sec.querySelector(".section-save-btn");
      if (!btn) {
        btn = document.createElement("button");
        btn.type = "button";
        btn.className = "section-save-btn";
        btn.textContent = "Salvar";
        btn.style.display = "none";
        sec.appendChild(btn);
      } else {
        btn.style.display = "none";
      }

      const onFocus = () => {
        original = (p.innerText || "").trim();
      };
      const onInput = () => {
        const curr = (p.innerText || "").trim();
        btn.style.display = curr !== original ? "inline-flex" : "none";
      };
      const onSave = async () => {
        const text = (p.innerText || "").trim();
        btn.disabled = true;
        try {
          if (!id) return;
          if (i === 0) {
            await fetchWithOperator(`${baseUrl}/patients/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ historicoClinico: text }),
            });
          } else if (i === 1) {
            await fetchWithOperator(`${baseUrl}/patients/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ medicacoes: text }),
            });
          } else if (i === 2) {
            await fetchWithOperator(`${baseUrl}/patients/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ alergias: text }),
            });
          } else if (i === 3) {
            await fetchWithOperator(`${baseUrl}/patients/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ anotacoes: text }),
            });
            try {
              setAnotacoes(text);
            } catch {}
            try {
              setFull((prev) => (prev ? { ...prev, anotacoes: text } : prev));
            } catch {}
          } else if (i === 4) {
            try {
              localStorage.setItem(`ultimaReviewIA:${id}`, text);
            } catch {}
            setReviewIA(text);
            setFull((prev) => (prev ? { ...prev, ultimaReviewIA: text } : prev));
          }

          original = text;
          btn.style.display = "none";
        } catch (e) {
          console.error(e);
          alert("Erro ao salvar.");
        } finally {
          btn.disabled = false;
        }
      };
      p.addEventListener("focus", onFocus);
      p.addEventListener("input", onInput);
      btn.addEventListener("click", onSave);
      pencilCleanups.push(() => {
        p.removeEventListener("focus", onFocus);
        p.removeEventListener("input", onInput);
        btn.removeEventListener("click", onSave);
        if (btn && btn.parentElement === sec) btn.remove();
      });
    });
    return () => {
      pencilCleanups.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, paciente?.id]);
  // Garante que a �ltima se��o (Review IA) tenha o mesmo visual das demais,
  // por�m permane�a n�o edit�vel
  useEffect(() => {
    try {
      const secs = document.querySelectorAll(".perfil-sections .section");
      const last = secs[secs.length - 1];
      if (!last) return;
      const p = last.querySelector("p");
      if (!p) return;
      p.removeAttribute("contenteditable");
      p.classList.add("editable-paragraph");
    } catch {}
  }, []);
  const getTelefones = () => {
    const src = full || paciente;
    const list = [];
    const pushStr = (v) => {
      if (!v) return;
      const s = String(v).trim();
      if (!s) return;
      // se vier como string com separadores, divide
      const parts = s
        .split(/[;,\r?\n]+/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length > 1) {
        list.push(...parts);
      } else {
        list.push(s);
      }
    };
    // Arrays conhecidos
    const arrayKeys = ["telefones", "phones", "telephones", "telefonesList"];
    for (const k of arrayKeys) {
      const v = src?.[k];
      if (Array.isArray(v)) list.push(...v);
      else if (typeof v === "string") {
        // tenta interpretar como JSON de array
        let parsed = null;
        try {
          parsed = JSON.parse(v);
        } catch {}
        if (Array.isArray(parsed)) list.push(...parsed);
        else pushStr(v);
      }
    }

    // Campos singulares comuns
    const singleKeys = [
      "telefone",
      "phone",
      "celular",
      "mobile",
      "telefone1",
      "telefone2",
      "telefone3",
    ];
    for (const k of singleKeys) pushStr(src?.[k]);
    let unique = Array.from(
      new Set(list.map((x) => String(x).trim()).filter(Boolean))
    );
    // Fallback: se nada veio do backend, tenta recuperar do localStorage por ID
    if (unique.length === 0) {
      try {
        const id = src?.id;
        if (id != null) {
          const raw = localStorage.getItem(`phones:${id}`);
          const arr = JSON.parse(raw || "[]");
          if (Array.isArray(arr)) {
            unique = Array.from(
              new Set(arr.map((x) => String(x).trim()).filter(Boolean))
            );
          }
        }
      } catch {}
    }

    return unique;
  };
  const telefonesArr = getTelefones();
  const idade = calcAgeYears(full?.nascimento || paciente?.nascimento);
  const formatCPF = (value) => {
    const v = String(value || "")
      .replace(/\D/g, "")
      .slice(0, 11);
    if (v.length <= 3) return v;
    if (v.length <= 6) return v.replace(/(\d{3})(\d+)/, "$1.$2");
    if (v.length <= 9) return v.replace(/(\d{3})(\d{3})(\d+)/, "$1.$2.$3");
    return v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
  };
  // Edi��o do perfil (nome, cpf, nascimento, telefones, genero)
  const [editingProfile, setEditingProfile] = useState(false);
  const [formNomeCompleto, setFormNomeCompleto] = useState(nomeCompleto || "");
  const [formCpf, setFormCpf] = useState(full?.cpf || paciente?.cpf || "");
  const [formNascimento, setFormNascimento] = useState(() => {
    const raw = full?.nascimento || paciente?.nascimento;
    if (!raw) return "";
    const s = String(raw);
    if (s.includes("T")) return s.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    try {
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) return d.toISOString().split("T")[0];
    } catch {}
    return "";
  });
  const [formGenero, setFormGenero] = useState(
    full?.genero || paciente?.genero || ""
  );

  const avatarInfo = useMemo(() => {
    const candidates = [
      formGenero,
      full?.genero,
      full?.dadosBasicos?.genero,
      paciente?.genero,
      paciente?.gender,
      paciente?.sexo,
    ];
    const raw = candidates.find((value) =>
      typeof value === "string" && value.trim().length > 0
    );
    const normalized = String(raw || "").trim().toLowerCase();
    const isFemale = normalized.startsWith("f") || normalized.startsWith("mulher");
    return {
      icon: isFemale ? MulherIcon : HomemIcon,
      alt: isFemale ? "Foto da paciente" : "Foto do paciente",
    };
  }, [
    formGenero,
    full?.genero,
    full?.dadosBasicos?.genero,
    paciente?.genero,
    paciente?.gender,
    paciente?.sexo,
  ]);
  const [formPhones, setFormPhones] = useState(() =>
    (telefonesArr || []).join("\n")
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [dirtyProfile, setDirtyProfile] = useState(false);
  const [activeTab, setActiveTab] = useState("sobre");
  useEffect(() => {
    if (!editingProfile) return;
    // ressincroniza caso full seja carregado
    setFormNomeCompleto(
      [
        (full?.nome ?? paciente?.nome) || "",
        (full?.sobrenome ?? paciente?.sobrenome) || "",
      ]
        .filter(Boolean)
        .join(" ")
    );
    setFormCpf(full?.cpf || paciente?.cpf || "");
    setFormGenero(full?.genero || paciente?.genero || "");
    setFormPhones((getTelefones() || []).join("\n"));
    const raw = full?.nascimento || paciente?.nascimento;
    if (raw) {
      const s = String(raw);
      const val = s.includes("T")
        ? s.split("T")[0]
        : /^\d{4}-\d{2}-\d{2}$/.test(s)
        ? s
        : (() => {
            try {
              const d = new Date(s);
              return !Number.isNaN(d.getTime())
                ? d.toISOString().split("T")[0]
                : "";
            } catch {
              return "";
            }
          })();
      setFormNascimento(val);
    }

    setDirtyProfile(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingProfile, full?.id]);
  const handleSaveProfile = async () => {
    const id = routeId;
    if (!id) return;
    setSavingProfile(true);
    try {
      // nome/sobrenome a partir de nome completo
      const fullTrim = String(formNomeCompleto || "").trim();
      let nome = fullTrim;
      let sobrenome = "";
      const parts = fullTrim.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        sobrenome = parts.pop();
        nome = parts.join(" ");
      }

      const payload = {
        genero: formGenero || "",
        nome,
        sobrenome,
        cpf: (formCpf || "").replace(/\D/g, ""),
        nascimento: formNascimento || undefined,
        telefones: String(formPhones || "")
          .split(/[;,\r?\n]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const res = await fetchWithOperator(`${baseUrl}/patients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      const updated = await res.json();
      setFull(updated);
      // Telefones: persiste localmente
      try {
        const list = String(formPhones || "")
          .split(/[;,\r?\n]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        localStorage.setItem(`phones:${id}`, JSON.stringify(list));
      } catch {}
      setEditingProfile(false);
      setDirtyProfile(false);
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar o perfil.");
    } finally {
      setSavingProfile(false);
    }
  };
  return (
    <div className="page-background">
      <Header mostrarMenu={false} />
      <main className="perfil-container">
        <div className="perfil-topbar">
          <div
            className="perfil-nav"
            role="tablist"
            aria-label="Seleções do perfil"
          >
            <button
              className="tab"
              type="button"
              role="tab"
              aria-selected="true"
            >
              Sobre o paciente
            </button>
            <button className="tab" type="button" disabled>
              Estatísticas do paciente
            </button>
            <button className="tab" type="button" disabled>
              Plano alimentar
            </button>
          </div>
        </div>
        {!full && !paciente ? (
          <section className="empty-state">
            <p>
              {routeId
                ? `Carregando paciente #${routeId}...`
                : "Nenhum paciente fornecido."}
            </p>
          </section>
        ) : (
          <div className="perfil-grid">
            {activeTab === "dieta" && (
              <div className="meal-goals-wrapper">
                <div className="meal-goals card">
                  <div className="meal-goals-header">
                    <h3 className="meal-goals-title">Macro diário</h3>
                    <button
                      type="button"
                      className="meal-goals-clear"
                      onClick={handleClearMacroTargets}
                    >
                      Limpar
                    </button>
                  </div>
                  <div className="meal-goals-grid">
                    {MACRO_ENTRIES.map((entry) => (
                      <label key={entry.key} className="meal-goal-field">
                        <span className="meal-goal-name">{entry.label}</span>
                        <div className="meal-goal-input-wrapper">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            className="meal-goal-input"
                            value={macroTargetInputs[entry.key] ?? ""}
                            onChange={handleMacroTargetChange(entry.key)}
                            aria-label={`Meta de ${entry.label} em gramas`}
                          />
                          <span className="meal-goal-suffix">g</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {activeTab === "dieta" && (
              <div className="meal-header">
                <button
                  type="button"
                  className="meal-add-btn"
                  onClick={handleAddMeal}
                >
                  + Adicionar nova refeição
                </button>
              </div>
            )}
            <aside
              className={`perfil-summary card${
                activeTab === "dieta" ? " summary-cleared" : ""
              }`}
            >
              <div className="summary-default">
                <img
                  src={LixeiraIcon}
                  alt="Excluir perfil do paciente"
                  className="perfil-delete-btn"
                  title="Excluir perfil"
                  role="button"
                  draggable={false}
                  tabIndex={0}
                  onClick={handleDelete}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleDelete();
                    }
                  }}
                />
                <img
                  src={EditIcon}
                  alt="Editar dados do paciente"
                  className="perfil-edit-btn"
                  title="Editar perfil"
                  role="button"
                  draggable={false}
                  tabIndex={0}
                  onClick={() => setEditingProfile((v) => !v)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setEditingProfile((v) => !v);
                    }
                  }}
                />
                <div className="perfil-avatar">
                  <img src={avatarInfo.icon} alt={avatarInfo.alt} />
                </div>
                {editingProfile && (
                  <button
                    type="button"
                    className="perfil-save-btn"
                    disabled={savingProfile || !dirtyProfile}
                    onClick={handleSaveProfile}
                  >
                    {savingProfile ? "Salvando..." : "Salvar alterações"}
                  </button>
                )}
                {editingProfile ? (
                  <input
                    className="perfil-edit-input nome"
                    value={formNomeCompleto}
                    onChange={(e) => {
                      setFormNomeCompleto(e.target.value);
                      setDirtyProfile(true);
                    }}
                    placeholder="Nome completo"
                  />
                ) : (
                  <h2 className="nome">{nomeCompleto || "-"}</h2>
                )}
                <div className="linha">
                  <div className="linha">
                    ID: {full?.id ?? paciente?.id ?? routeId ?? "-"}
                  </div>
                </div>
                <div className="campo">
                  <div className="rotulo">CPF</div>
                  <div className="valor">
                    {editingProfile ? (
                      <input
                        className="perfil-edit-input"
                        value={formCpf}
                        onChange={(e) => {
                          setFormCpf(e.target.value);
                          setDirtyProfile(true);
                        }}
                        placeholder="CPF"
                      />
                    ) : full?.cpf || paciente?.cpf ? (
                      formatCPF(full?.cpf || paciente?.cpf)
                    ) : (
                      "-"
                    )}
                  </div>
                </div>
                <div className="campo">
                  <div className="rotulo">Data de nascimento</div>
                  <div className="valor">
                    {editingProfile ? (
                      <input
                        type="date"
                        className="perfil-edit-input"
                        value={formNascimento}
                        onChange={(e) => {
                          setFormNascimento(e.target.value);
                          setDirtyProfile(true);
                        }}
                      />
                    ) : full?.nascimento || paciente?.nascimento ? (
                      `${formatDate(full?.nascimento || paciente?.nascimento)}${
                        idade != null ? ` (${idade} anos)` : ""
                      }`
                    ) : (
                      "-"
                    )}
                  </div>
                </div>
                <div className="campo">
                  <div className="rotulo">Telefone(s)</div>
                  <div className="valor">
                    {editingProfile ? (
                      <textarea
                        className="perfil-edit-textarea"
                        value={formPhones}
                        onChange={(e) => {
                          setFormPhones(e.target.value);
                          setDirtyProfile(true);
                        }}
                        placeholder="Separar por quebra de linha, virgula ou ponto e virgula"
                      />
                    ) : telefonesArr && telefonesArr.length > 0 ? (
                      <ul className="phones-list">
                        {telefonesArr.map((t) => (
                          <li key={t}>{t}</li>
                        ))}
                      </ul>
                    ) : (
                      "-"
                    )}
                  </div>
                </div>
                <div className="campo">
                  <div className="rotulo">Gênero</div>
                  <div className="valor">{paciente?.genero || "-"}</div>
                </div>
                <div className="campo">
                  <div className="rotulo">Registrado(a)</div>
                  <div className="valor">
                    {full?.primeiraConsulta || paciente?.primeiraConsulta
                      ? formatDate(
                          full?.primeiraConsulta || paciente?.primeiraConsulta
                        )
                      : full?.createdAt || paciente?.createdAt
                      ? formatDate(full?.createdAt || paciente?.createdAt)
                      : "-"}
                  </div>
                </div>
                <div className="campo">
                  <div className="rotulo">Última consulta</div>
                  <div className="valor">-</div>
                </div>
              </div>
              {activeTab === "dieta" && (
                <div
                  className="summary-dieta"
                  aria-label="Resumo do plano alimentar"
                >
                  <div className="dieta-total-energy-group">
                    <span className="dieta-total-energy-label">
                      Valor energetico total
                    </span>
                    <span className="dieta-total-energy-value">
                      {totalEnergyDisplay} kcal
                    </span>
                  </div>
                  <div className="macro-chart">
                    <div
                      className="macro-chart-circle"
                      style={{ background: macroChart.gradient }}
                      role="img"
                      aria-label="Distribuicao de macronutrientes"
                    />
                    <ul className="macro-chart-legend">
                      {macroChart.legend.map((item) => (
                        <li className="macro-legend-item" key={item.key}>
                          <span
                            className="macro-legend-icon"
                            style={{ "--macro-color": item.color }}
                          />
                          <div className="macro-legend-info">
                            <div className="macro-legend-row">
                              <span>{item.label}</span>
                              <span>
                                {`${formatNumericValue(item.value)} g`}
                                <span className="macro-legend-target">
                                  {` / ${formatNumericValue(item.target, 0)} g`}
                                </span>
                              </span>
                            </div>
                            <div
                              className="macro-legend-progress"
                              style={{
                                "--macro-progress": item.ratio,
                                "--macro-color": item.color,
                                "--macro-bg": item.background,
                              }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </aside>
            <section className="perfil-sections">
              <div className="section section-plain">
                <h3>Histórico clínico</h3>
                <p>{paciente?.historicoClinico || "Não consta nada."}</p>
              </div>
              <div className="section section-plain">
                <h3>Medicações em uso</h3>
                <p>
                  {(full?.medicacoes ?? paciente?.medicacoes) ||
                    "Não consta nada."}
                </p>
              </div>
              <div className="section section-plain">
                <h3>Alergias ou intolerâncias</h3>
                <p>{paciente?.alergias || "Não consta nada."}</p>
              </div>
              <div className="section section-plain">
                <h3>Anotações</h3>
                <p>
                  {(full?.anotacoes ?? paciente?.anotacoes) ||
                    "Não consta nada."}
                </p>
              </div>
              <div className="section section-plain">
                <h3>Última review de Inteligência Artificial</h3>
                <p>{reviewIA || "Nao consta nada."}</p>
              </div>
            </section>
            {/* Dieta montada (placeholder) */}
            <section
              className="perfil-dieta"
              aria-label="Dieta montada"
              style={{ display: "none" }}
            >
              <div className="section section-plain">
                <div className="meal-sync-indicator">
                  {planSaving ? (
                    <span className="meal-sync-status">
                      Salvando alterações...
                    </span>
                  ) : planSyncError ? (
                    <span className="meal-sync-error">{planSyncError}</span>
                  ) : planLoaded && !hasPendingPlanChanges ? (
                    <span className="meal-sync-status ok"></span>
                  ) : null}
                </div>
                <div className="meal-list">
                  {meals.map((meal) => {
                    const foods = Array.isArray(meal.foods) ? meal.foods : [];
                    const macroFields = [
                      { key: "energy", label: "Energia", suffix: "kcal" },
                      { key: "fat", label: "Gordura", suffix: "g" },
                      { key: "carbs", label: "Carboídratos", suffix: "g" },
                      { key: "protein", label: "Proteína", suffix: "g" },
                      { key: "fiber", label: "Fibra alimentar", suffix: "g" },
                    ];
                    return (
                      <article key={meal.id} className="meal-card card">
                        <div className="meal-card-header">
                          <div className="meal-card-info">
                            <span
                              className="meal-time meal-editable"
                              contentEditable
                              suppressContentEditableWarning
                              spellCheck={false}
                              onBlur={handleMealFieldBlur(meal.id, "time")}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  e.currentTarget.blur();
                                }
                              }}
                            >
                              {meal.time}
                            </span>
                            <span
                              className="meal-title meal-editable"
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={handleMealFieldBlur(meal.id, "title")}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  e.currentTarget.blur();
                                }
                              }}
                            >
                              {meal.title}
                            </span>
                          </div>
                          <div className="meal-card-actions">
                            {meal.hasChanges && (
                              <img
                                src={SaveIcon}
                                alt="Salvar refeição"
                                className={`meal-save-btn${meal.isSaving ? ' is-disabled' : ''}`}
                                title="Salvar refeição"
                                role="button"
                                draggable={false}
                                tabIndex={meal.isSaving ? -1 : 0}
                                aria-disabled={meal.isSaving}
                                onClick={meal.isSaving ? undefined : () => handleSaveMeal(meal.id)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    if (!meal.isSaving) handleSaveMeal(meal.id);
                                  }
                                }}
                              />
                            )}
                            <img
                              src={LixeiraIcon}
                              alt="Excluir refeição"
                              className="meal-delete-btn"
                              title="Excluir refeição"
                              role="button"
                              draggable={false}
                              tabIndex={0}
                              onClick={() => handleRemoveMeal(meal.id)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  handleRemoveMeal(meal.id);
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div className="meal-card-body">
                          {foods.length > 0 && (
                            <ul className="meal-foods">
                              {foods.map((food) => {
                                const equivalents = Array.isArray(
                                  food.equivalents
                                )
                                  ? food.equivalents
                                  : [];
                                return (
                                  <li key={food.id} className="meal-food-row">
                                    <div className="meal-food-main">
                                      <input
                                        type="text"
                                        className="meal-food-input meal-food-name"
                                        placeholder="Alimento"
                                        value={food.name}
                                        onChange={handleFoodFieldChange(
                                          meal.id,
                                          food.id,
                                          "name"
                                        )}
                                      />
                                      <div className="meal-food-qty-wrapper">
                                        <input
                                          type="number"
                                          className="meal-food-input meal-food-qty"
                                          placeholder="Qtd"
                                          min="0"
                                          value={food.quantity}
                                          onChange={handleFoodFieldChange(
                                            meal.id,
                                            food.id,
                                            "quantity"
                                          )}
                                        />
                                        <span className="meal-food-unit">
                                          g
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        className="meal-equivalent-btn"
                                        onClick={() =>
                                          handleAddEquivalent(meal.id, food.id)
                                        }
                                      >
                                        Alimento equivalente
                                      </button>
                                      <button
                                        type="button"
                                        className="meal-remove-food-btn"
                                        onClick={() =>
                                          handleRemoveFood(meal.id, food.id)
                                        }
                                      >
                                        Remover
                                      </button>
                                    </div>
                                    {equivalents.length > 0 && (
                                      <ul className="meal-equivalents">
                                        {equivalents.map((equivalent) => (
                                          <li
                                            key={equivalent.id}
                                            className="meal-equivalent-row"
                                          >
                                            <span className="meal-equivalent-or">
                                              ou
                                            </span>
                                            <input
                                              type="text"
                                              className="meal-food-input meal-equivalent-name"
                                              placeholder="Alimento equivalente"
                                              value={equivalent.name}
                                              onChange={handleEquivalentFieldChange(
                                                meal.id,
                                                food.id,
                                                equivalent.id,
                                                "name"
                                              )}
                                            />
                                            <div className="meal-food-qty-wrapper">
                                              <input
                                                type="number"
                                                className="meal-food-input meal-equivalent-qty"
                                                placeholder="Qtd"
                                                min="0"
                                                value={equivalent.quantity}
                                                onChange={handleEquivalentFieldChange(
                                                  meal.id,
                                                  food.id,
                                                  equivalent.id,
                                                  "quantity"
                                                )}
                                              />
                                              <span className="meal-food-unit">
                                                g/ml
                                              </span>
                                              <button
                                                type="button"
                                                className="meal-remove-equivalent-btn"
                                                onClick={() =>
                                                  handleRemoveEquivalent(
                                                    meal.id,
                                                    food.id,
                                                    equivalent.id
                                                  )
                                                }
                                              >
                                                Remover
                                              </button>
                                            </div>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                          <button
                            type="button"
                            className="meal-add-food-btn"
                            onClick={() => handleAddFood(meal.id)}
                          >
                            + Adicionar novo alimento
                          </button>
                          <div className="meal-note">
                            <label
                              className="meal-note-label"
                              htmlFor={`meal-note-${meal.id}`}
                            >
                              Nota
                            </label>
                            <textarea
                              id={`meal-note-${meal.id}`}
                              className="meal-note-input"
                              placeholder="Escreva uma nota relevante"
                              value={meal.note ?? ""}
                              onChange={handleMealNoteChange(meal.id)}
                              rows={3}
                            />
                          </div>
                          <div className="meal-macros">
                            <div className="meal-macro-grid">
                              {macroFields.map(({ key, label, suffix }) => (
                                <label key={key} className="meal-macro-field">
                                  <span className="meal-macro-name">
                                    {label}
                                  </span>
                                  <div className="meal-macro-input-wrapper">
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      min="0"
                                      step="any"
                                      className="meal-macro-input"
                                      placeholder=""
                                      value={meal[key] ?? ""}
                                      onChange={handleMealMacroChange(
                                        meal.id,
                                        key
                                      )}
                                    />
                                    {suffix && (
                                      <span className="meal-macro-suffix">
                                        {suffix}
                                      </span>
                                    )}
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                  {meals.length === 0 && (
                    <p className="meal-empty-hint">
                      Nenhuma refeição adicionada ainda.
                    </p>
                  )}
                </div>
              </div>
            </section>
            <section
              className="perfil-stats"
              aria-label="Estatísticas do paciente"
              style={{ display: "none" }}
            >
              {(() => {
                const g = String(
                  (full?.genero ?? paciente?.genero) || ""
                ).toLowerCase();
                const isFem = g.startsWith("f");
                const ev =
                  evals.find((e) => e?.id === selectedEvalId) || lastEval || {};
                const altura = ev.alturaCm;
                const peso = ev.peso;
                const imcCalc = (() => {
                  if (ev?.imc != null && Number.isFinite(ev.imc)) return ev.imc;
                  const h = Number(altura) / 100;
                  const p = Number(peso);
                  if (Number.isFinite(h) && h > 0 && Number.isFinite(p)) {
                    const v = p / (h * h);
                    return Number.isFinite(v) ? v : null;
                  }

                  return null;
                })();
                const fmt = (v, unit) =>
                  v == null || Number.isNaN(v)
                    ? "-"
                    : `${Number(v).toFixed(2)}${unit ? " " + unit : ""}`;
                const fmt0 = (v, unit) =>
                  v == null || Number.isNaN(v)
                    ? "-"
                    : `${Number(v).toFixed(0)}${unit ? " " + unit : ""}`;
                return (
                  <>
                    {/* Filtro por data da consulta */}
                    <div className="stats-toolbar">
                      <div className="stats-filter">
                        <label htmlFor="stats-date-select">
                          Data da consulta:
                        </label>
                        <select
                          id="stats-date-select"
                          value={selectedEvalId ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setSelectedEvalId(v === "" ? null : Number(v));
                          }}
                        >
                          <option value="">Mais recente</option>
                          {Array.isArray(evals) &&
                            evals.map((it) => (
                              <option key={it.id} value={it.id}>
                                {formatDate(it.createdAt)}
                              </option>
                            ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        className="stats-delete-btn"
                        onClick={handleDeleteEvaluation}
                      >
                        Excluir consulta
                      </button>
                    </div>
                    {/* Topo: Altura, Peso, IMC */}
                    <h3 className="stats-title">Geral</h3>
                    <div className="stats-grid">
                      <div className="stat-card card">
                        <div className="k">Altura</div>
                        <div className="v">
                          {altura == null || Number.isNaN(altura)
                            ? "-"
                            : `${Math.round(Number(altura))} cm`}
                        </div>
                      </div>
                      <div className="stat-card card">
                        <div className="k">Peso</div>
                        <div className="v">{fmt(peso, "kg")}</div>
                      </div>
                      <div className="stat-card card">
                        <div className="k">IMC</div>
                        <div className="v">
                          {imcCalc == null ? "-" : imcCalc.toFixed(2)}
                        </div>
                      </div>
                      <div className="stat-card card">
                        <div className="k">Percentual de gordura</div>
                        <div className="v">
                          {(() => {
                            const percentualGordura = calcularPercentualGordura(
                              ev,
                              g
                            );
                            return percentualGordura == null
                              ? "-"
                              : `${percentualGordura.toFixed(1)}%`;
                          })()}
                        </div>
                      </div>
                    </div>
                    {/* Medidas corporais */}
                    <h3 className="stats-title">medidas corporais</h3>
                    <div className="stats-grid">
                      <div className="stat-card card">
                        <div className="k">Braço relaxado</div>
                        <div className="v">{fmt(ev.bracoRelaxado, "cm")}</div>
                      </div>
                      <div className="stat-card card">
                        <div className="k">Braço contraído</div>
                        <div className="v">{fmt(ev.bracoContraido, "cm")}</div>
                      </div>
                      <div className="stat-card card">
                        <div className="k">Cintura</div>
                        <div className="v">{fmt(ev.cintura, "cm")}</div>
                      </div>
                      <div className="stat-card card">
                        <div className="k">Quadril</div>
                        <div className="v">{fmt(ev.quadril, "cm")}</div>
                      </div>
                      <div className="stat-card card">
                        <div className="k">Abdomen</div>
                        <div className="v">{fmt(ev.abdomen, "cm")}</div>
                      </div>
                      <div className="stat-card card">
                        <div className="k">Coxa</div>
                        <div className="v">{fmt(ev.coxa, "cm")}</div>
                      </div>
                      <div className="stat-card card">
                        <div className="k">Panturrilha</div>
                        <div className="v">{fmt(ev.panturrilha, "cm")}</div>
                      </div>
                    </div>
                    {/* Dobras corporais */}
                    <h3 className="stats-title">dobras corporais</h3>
                    <div className="stats-grid">
                      {isFem ? (
                        <>
                          <div className="stat-card card">
                            <div className="k">Dobra cutânea tricipital</div>
                            <div className="v">{fmt0(ev.peitoralMm, "mm")}</div>
                          </div>
                          <div className="stat-card card">
                            <div className="k">Dobra cutânea supra-ilíaca</div>
                            <div className="v">{fmt0(ev.abdomenMm, "mm")}</div>
                          </div>
                          <div className="stat-card card">
                            <div className="k">Dobra cutânea da coxa</div>
                            <div className="v">{fmt0(ev.coxaMm, "mm")}</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="stat-card card">
                            <div className="k">Dobra cutânea peitoral</div>
                            <div className="v">{fmt0(ev.peitoralMm, "mm")}</div>
                          </div>
                          <div className="stat-card card">
                            <div className="k">Dobra cutânea abdominal</div>
                            <div className="v">{fmt0(ev.abdomenMm, "mm")}</div>
                          </div>
                          <div className="stat-card card">
                            <div className="k">Dobra cutânea da coxa</div>
                            <div className="v">{fmt0(ev.coxaMm, "mm")}</div>
                          </div>
                        </>
                      )}
                    </div>
                    {/* grid antigo (oculto por CSS) */}
                    <div className="stats-grid old-grid">
                      <div className="stat-card card">
                        <div className="k">Altura</div>
                        <div className="v">
                          {altura == null || Number.isNaN(altura)
                            ? "-"
                            : `${Math.round(Number(altura))} cm`}
                        </div>
                      </div>
                      <div className="stat-card card">
                        <div className="k">Peso</div>
                        <div className="v">{fmt(peso, "kg")}</div>
                      </div>
                      <div className="stat-card card">
                        <div className="k">IMC</div>
                        <div className="v">
                          {imcCalc == null ? "-" : imcCalc.toFixed(2)}
                        </div>
                      </div>
                      <div className="stat-card card">
                        <div className="k">Percentual de gordura</div>
                        <div className="v">
                          {(() => {
                            const percentualGordura = calcularPercentualGordura(
                              ev,
                              g
                            );
                            return percentualGordura == null
                              ? "-"
                              : `${percentualGordura.toFixed(1)}%`;
                          })()}
                        </div>
                      </div>
                      <div className="stat-card card">
                        <div className="k">Braço relaxado</div>
                        <div className="v">{fmt(ev.bracoRelaxado, "cm")}</div>
                      </div>
                      <div className="stat-card card">
                        <div className="k">Braço contraído</div>
                        <div className="v">{fmt(ev.bracoContraido, "cm")}</div>
                      </div>
                      <div className="stat-card card">
                        <div className="k">Cintura</div>
                        <div className="v">{fmt(ev.cintura, "cm")}</div>
                      </div>
                      <div className="stat-card card">
                        <div className="k">Quadril</div>
                        <div className="v">{fmt(ev.quadril, "cm")}</div>
                      </div>
                      <div className="stat-card card">
                        <div className="k">Abdômen</div>
                        <div className="v">{fmt(ev.abdomen, "cm")}</div>
                      </div>
                      <div className="stat-card card">
                        <div className="k">Coxa</div>
                        <div className="v">{fmt(ev.coxa, "cm")}</div>
                      </div>
                      <div className="stat-card card">
                        <div className="k">Panturrilha</div>
                        <div className="v">{fmt(ev.panturrilha, "cm")}</div>
                      </div>
                      {isFem ? (
                        <>
                          <div className="stat-card card">
                            <div className="k">Tríceps (mm)</div>
                            <div className="v">{fmt0(ev.peitoralMm, "mm")}</div>
                          </div>
                          <div className="stat-card card">
                            <div className="k">Supra-ilíaca (mm)</div>
                            <div className="v">{fmt0(ev.abdomenMm, "mm")}</div>
                          </div>
                          <div className="stat-card card">
                            <div className="k">Coxa (mm)</div>
                            <div className="v">{fmt0(ev.coxaMm, "mm")}</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="stat-card card">
                            <div className="k">Peitoral (mm)</div>
                            <div className="v">{fmt0(ev.peitoralMm, "mm")}</div>
                          </div>
                          <div className="stat-card card">
                            <div className="k">Abdomen (mm)</div>
                            <div className="v">{fmt0(ev.abdomenMm, "mm")}</div>
                          </div>
                          <div className="stat-card card">
                            <div className="k">Coxa (mm)</div>
                            <div className="v">{fmt0(ev.coxaMm, "mm")}</div>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                );
              })()}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default PerfilPaciente;
