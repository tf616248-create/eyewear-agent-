"""Small, repeatable evaluation suite for find_similar_frames()."""

from __future__ import annotations

import sys
import random
from pathlib import Path


# Make the script work both as `python backend/eval_recommendations.py` and
# when it is launched from inside the backend directory.
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from workflow.embedding_service import (  # noqa: E402
    build_index,
    cosine_similarity,
    find_similar_frames,
    get_embedding,
    load_inventory,
    session_to_text,
)
from workflow.recommendation_chain import get_ranked_frames  # noqa: E402
from workflow.reranking_service import _parse_budget, rerank_frames  # noqa: E402


TEST_CASES = [
    {
        "name": "אובלי קלאסי בתקציב בינוני",
        "session": {
            "faceData": {"faceShape": "אובלי"},
            "answers": {"usage": "יום יום", "style": "קלאסי", "budget": "עד 550"},
        },
        "expected_frame_ids": ["frame_001", "frame_002", "frame_003"],
    },
    {
        "name": "עגול מקצועי וקל",
        "session": {
            "faceData": {"faceShape": "עגול"},
            "answers": {"usage": "עבודה", "style": "מקצועי-מינימליסטי", "budget": "עד 600"},
        },
        "expected_frame_ids": ["frame_002", "frame_005", "frame_004"],
    },
    {
        "name": "מרובע וינטאג׳ בתקציב נמוך",
        "session": {
            "faceData": {"faceShape": "מרובע"},
            "answers": {"usage": "יום יום", "style": "וינטאג׳", "budget": "עד 450"},
        },
        "expected_frame_ids": ["frame_003", "frame_002"],
    },
    {
        "name": "לבבי אלגנטי",
        "session": {
            "faceData": {"faceShape": "לבבי"},
            "answers": {"usage": "אירועים", "style": "אלגנטי", "budget": "עד 500"},
        },
        "expected_frame_ids": ["frame_004", "frame_001", "frame_005"],
    },
    {
        "name": "משולש קלאסי",
        "session": {
            "faceData": {"faceShape": "משולש"},
            "answers": {"usage": "יום יום", "style": "קלאסי", "budget": "עד 550"},
        },
        "expected_frame_ids": ["frame_001", "frame_003"],
    },
    {
        "name": "נועז ומרובע לפנים עגולות",
        "session": {
            "faceData": {"faceShape": "עגול"},
            "answers": {"usage": "יציאות", "style": "נועז-מודרני", "budget": "עד 500"},
        },
        "expected_frame_ids": ["frame_005", "frame_004", "frame_002"],
    },
    {
        "name": "קשה: צורת פנים לא ידועה",
        "session": {
            "faceData": {"faceShape": "יהלום"},
            "answers": {"usage": "יום יום", "style": "מודרני", "budget": "עד 500"},
        },
        "expected_frame_ids": ["frame_002", "frame_005", "frame_003"],
    },
    {
        "name": "קשה: אין התאמת צורת פנים במלאי",
        "session": {
            "faceData": {"faceShape": "מוארך"},
            "answers": {"usage": "עבודה", "style": "מקצועי", "budget": "עד 600"},
        },
        "expected_frame_ids": ["frame_002", "frame_003"],
    },
    {
        "name": "קשה: פרופיל חלקי וריק",
        "session": {
            "faceData": {"faceShape": ""},
            "answers": {"usage": "", "style": "", "budget": ""},
        },
        "expected_frame_ids": ["frame_001", "frame_002", "frame_003"],
    },
    {
        "name": "העדפת גברית עם התאמת סגנון",
        "session": {
            "faceData": {"faceShape": "עגול"},
            "answers": {
                "usage": "עבודה",
                "style": "מקצועי-מינימליסטי",
                "budget": "עד 600",
                "gender": "גבר",
            },
        },
        "expected_frame_ids": ["frame_002", "frame_005", "frame_001"],
    },
    {
        "name": "העדפת נשית ללא סינון מסגרות אחרות",
        "session": {
            "faceData": {"faceShape": "לבבי"},
            "answers": {
                "usage": "אירועים",
                "style": "אלגנטי",
                "budget": "עד 500",
                "gender": "אישה",
            },
        },
        "expected_frame_ids": ["frame_004", "frame_001", "frame_005"],
    },
    {
        "name": "התאמה חד-משמעית: פנים מוארכות ופנטו",
        "session": {
            "faceData": {"faceShape": "מוארך"},
            "answers": {"usage": "יום יום", "style": "נוח-יומיומי", "budget": "עד 350"},
        },
        "expected_frame_ids": ["TEST_frame_024", "GEN_frame_038", "TEST_frame_029"],
    },
    {
        "name": "התאמה חד-משמעית: יהלום יוקרתי",
        "session": {
            "faceData": {"faceShape": "יהלום"},
            "answers": {"usage": "אירועים", "style": "יוקרתי", "budget": "גמיש"},
        },
        "expected_frame_ids": ["TEST_frame_027", "GEN_frame_033", "TEST_frame_030"],
    },
    {
        "name": "רטרו מתכתי לפנים מרובעות",
        "session": {
            "faceData": {"faceShape": "מרובע"},
            "answers": {"usage": "יציאות", "style": "רטרו-נועז", "budget": "עד 700"},
        },
        "expected_frame_ids": ["GEN_frame_031", "TEST_frame_003", "TEST_frame_020"],
    },
    {
        "name": "מינימליסטי זול לפנים אובליות",
        "session": {
            "faceData": {"faceShape": "אובלי"},
            "answers": {"usage": "עבודה", "style": "מינימליסטי", "budget": "עד 400"},
        },
        "expected_frame_ids": ["TEST_frame_016", "GEN_frame_034", "TEST_frame_026"],
    },
    {
        "name": "קשה: תקציב נמוך וסגנון יוקרתי",
        "session": {
            "faceData": {"faceShape": "לבבי"},
            "answers": {"usage": "יום יום", "style": "יוקרתי", "budget": "עד 250"},
        },
        "expected_frame_ids": ["GEN_frame_038", "TEST_frame_026", "TEST_frame_024"],
    },
    {
        "name": "קשה: ערך סגנון נדיר",
        "session": {
            "faceData": {"faceShape": "עגול"},
            "answers": {"usage": "עבודה", "style": "סקנדינבי", "budget": "עד 800"},
        },
        "expected_frame_ids": ["GEN_frame_034", "TEST_frame_017", "frame_002"],
    },
    {
        "name": "קשה: סתירה בין צבע למחיר",
        "session": {
            "faceData": {"faceShape": "משולש"},
            "answers": {"usage": "אירועים", "style": "אמנותי", "budget": "עד 300"},
        },
        "expected_frame_ids": ["GEN_frame_038", "TEST_frame_028", "TEST_frame_024"],
    },
    {
        "name": "קשה: פנים לא שכיחות ותקציב פתוח",
        "session": {
            "faceData": {"faceShape": "יהלום"},
            "answers": {"usage": "עבודה", "style": "מקצועי", "budget": "גמיש"},
        },
        "expected_frame_ids": ["GEN_frame_033", "TEST_frame_030", "TEST_frame_027"],
    },
    {
        "name": "גברית רחבה עם העדפת משקל",
        "session": {
            "faceData": {"faceShape": "עגול"},
            "answers": {"usage": "יום יום", "style": "קז׳ואל", "budget": "עד 450", "gender": "גבר"},
        },
        "expected_frame_ids": ["TEST_frame_018", "TEST_frame_026", "frame_005"],
    },
    {
        "name": "נשית גדולה לפנים מוארכות",
        "session": {
            "faceData": {"faceShape": "מוארך"},
            "answers": {"usage": "אירועים", "style": "זוהר", "budget": "עד 950", "gender": "אישה"},
        },
        "expected_frame_ids": ["GEN_frame_035", "GEN_frame_032", "TEST_frame_019"],
    },
    {
        "name": "דחיית מסגרת מובילה",
        "session": {
            "faceData": {"faceShape": "מרובע"},
            "answers": {"usage": "עבודה", "style": "קלאסי-מקצועי", "budget": "עד 650"},
            "rejectedFrameIds": ["GEN_frame_037"],
        },
        "expected_frame_ids": ["frame_002", "GEN_frame_031", "TEST_frame_022"],
    },
    {
        "name": "דחייה ו-stock אפס",
        "session": {
            "faceData": {"faceShape": "אובלי"},
            "answers": {"usage": "יום יום", "style": "מינימליסטי", "budget": "עד 600"},
            "rejectedFrameIds": ["TEST_frame_016", "GEN_frame_036"],
        },
        "expected_frame_ids": ["GEN_frame_034", "TEST_frame_022", "frame_002"],
    },
]


def raw_scores_for(
    session: dict,
    frames: list[dict],
    additional_ids: list[str] | None = None,
) -> dict[str, float]:
    """Return raw embedding scores for returned frames, before any reranking."""
    session_embedding = get_embedding(session_to_text(session))
    index = build_index()
    embeddings_by_id = {item["frame"]["id"]: item["embedding"] for item in index}
    frames_by_id = {item["frame"]["id"]: item["frame"] for item in index}
    frame_ids = [frame["id"] for frame in frames]
    frame_ids.extend(additional_ids or [])
    return {
        frame_id: cosine_similarity(session_embedding, embeddings_by_id[frame_id])
        for frame_id in frame_ids
        if frame_id in frames_by_id
    }


def rerank_breakdown(frame: dict, session: dict) -> dict[str, float]:
    """Mirror reranking_service.score_frame() for diagnostic output only."""
    answers = session.get("answers", {})
    face_data = session.get("faceData", {})
    budget = answers.get("budget", "")
    style = answers.get("style", "")
    face_shape = face_data.get("faceShape", "")
    gender = answers.get("gender", "")

    stock_score = 10 if frame.get("stock", 0) >= 6 else 5 if frame.get("stock", 0) >= 3 else 1
    price = frame.get("price", 0)
    budget_score = 0
    if budget == "גמיש":
        budget_score = 10
    else:
        user_budget = _parse_budget(budget)
        frame_budget = _parse_budget(price)
        if user_budget and frame_budget:
            user_min, user_max = user_budget
            frame_min, frame_max = frame_budget
            effective_user_max = user_max if user_max is not None else float("inf")
            effective_frame_max = frame_max if frame_max is not None else frame_min
            if user_min <= effective_frame_max and frame_min <= effective_user_max:
                budget_score = 20

    style_score = 25 if style and style.lower() in frame.get("style", "").lower() else 0
    face_score = 30 if face_shape and face_shape in frame.get("face_shapes_match", []) else 0
    weight_score = 5 if frame.get("weight", "") == "קל" else 3 if frame.get("weight", "") == "בינוני" else 0
    gender_score = 10 if gender and (gender == frame.get("gender") or frame.get("gender") == "יוניסקס") else 0
    return {
        "stock": stock_score,
        "budget": budget_score,
        "style": style_score,
        "face_shape": face_score,
        "weight": weight_score,
        "gender": gender_score,
        "total": stock_score + budget_score + style_score + face_score + weight_score + gender_score,
    }


def evaluate_random_baseline(
    runs: int = 1000,
    seed: int = 42,
) -> dict[str, float]:
    """Evaluate random top-six selections from each case's available inventory."""
    inventory = load_inventory()
    rng = random.Random(seed)
    totals = {"hit@1": 0.0, "hit@3": 0.0, "hit@6": 0.0}

    print(f"\nRunning random baseline ({runs} runs per test case)...\n")
    for case in TEST_CASES:
        rejected_ids = set(case["session"].get("rejectedFrameIds", []))
        available_frames = [
            frame
            for frame in inventory
            if frame.get("stock", 0) != 0 and frame["id"] not in rejected_ids
        ]
        if len(available_frames) < 6:
            raise ValueError("Random baseline requires at least six available frames")

        expected_ids = set(case["expected_frame_ids"])
        primary_id = case["expected_frame_ids"][0]
        case_totals = {"hit@1": 0, "hit@3": 0, "hit@6": 0}
        for _ in range(runs):
            sampled_ids = [frame["id"] for frame in rng.sample(available_frames, 6)]
            hits = {
                "hit@1": sampled_ids[0] == primary_id,
                "hit@3": bool(set(sampled_ids[:3]) & expected_ids),
                "hit@6": bool(set(sampled_ids[:6]) & expected_ids),
            }
            for metric, hit in hits.items():
                case_totals[metric] += int(hit)

        case_rates = {
            metric: case_totals[metric] / runs for metric in case_totals
        }
        for metric, rate in case_rates.items():
            totals[metric] += rate
        print(
            f"{case['name']}: "
            f"hit@1={case_rates['hit@1']:.1%}, "
            f"hit@3={case_rates['hit@3']:.1%}, "
            f"hit@6={case_rates['hit@6']:.1%}"
        )

    overall_rates = {metric: rate / len(TEST_CASES) for metric, rate in totals.items()}
    print(
        "Overall random baseline: "
        + ", ".join(f"{metric}={rate:.1%}" for metric, rate in overall_rates.items())
    )
    return overall_rates


def evaluate() -> dict[str, int]:
    counts = {"hit@1": 0, "hit@3": 0, "hit@6": 0}
    hit_at_1_failures: list[tuple[dict, list[dict], dict[str, float]]] = []

    print(f"Running {len(TEST_CASES)} recommendation test cases...\n")
    for case in TEST_CASES:
        expected_ids = case["expected_frame_ids"]
        returned_frames = find_similar_frames(case["session"], top_k=6)
        returned_ids = [frame["id"] for frame in returned_frames]

        hits = {
            "hit@1": bool(returned_ids and returned_ids[0] == expected_ids[0]),
            "hit@3": bool(set(returned_ids[:3]) & set(expected_ids)),
            "hit@6": bool(set(returned_ids[:6]) & set(expected_ids)),
        }
        for metric, hit in hits.items():
            counts[metric] += int(hit)

        primary_id = expected_ids[0]
        primary_rank = returned_ids.index(primary_id) + 1 if primary_id in returned_ids else None
        status = "PASS" if hits["hit@6"] else "FAIL"
        rank = f"primary={primary_rank}" if primary_rank is not None else "primary=not returned"
        print(f"{status:<4} {case['name']}: {returned_ids} ({rank})")

        if not hits["hit@1"]:
            hit_at_1_failures.append(
                (
                    case,
                    returned_frames,
                    raw_scores_for(
                        case["session"],
                        returned_frames,
                        additional_ids=[case["expected_frame_ids"][0]],
                    ),
                )
            )

    total = len(TEST_CASES)
    print("\nSummary")
    print("-------")
    for metric in ("hit@1", "hit@3", "hit@6"):
        print(f"{metric}: {counts[metric]}/{total} ({counts[metric] / total:.1%})")

    if hit_at_1_failures:
        print("\nHit@1 failures: embedding vs rerank diagnostics")
        print("-----------------------------------------------")
        for case, returned_frames, raw_scores in hit_at_1_failures:
            expected_id = case["expected_frame_ids"][0]
            returned_ids = [frame["id"] for frame in returned_frames]
            reranked_frames = rerank_frames(returned_frames, case["session"], [])
            reranked_winner = reranked_frames[0] if reranked_frames else None
            actual_first = returned_frames[0] if returned_frames else None
            print(f"\n{case['name']}")
            print(f"  expected_frame_ids[0]: {expected_id}")
            if actual_first:
                actual_breakdown = rerank_breakdown(actual_first, case["session"])
                breakdown_text = ", ".join(
                    f"{name}={score:g}" for name, score in actual_breakdown.items()
                )
                print(f"  actual first from find_similar_frames(): {actual_first['id']}")
                print(f"  rerank breakdown for actual first: {breakdown_text}")
            else:
                print("  actual first from find_similar_frames(): (none)")
            if reranked_winner:
                winner_breakdown = rerank_breakdown(reranked_winner, case["session"])
                print(
                    f"  rerank winner: {reranked_winner['id']} "
                    f"(score={winner_breakdown['total']:g})"
                )
            expected_raw = raw_scores.get(expected_id, float("nan"))
            actual_raw = raw_scores.get(returned_ids[0], float("nan")) if returned_ids else float("nan")
            print(
                f"  raw similarity: expected {expected_id}={expected_raw:.6f}; "
                f"actual first {returned_ids[0] if returned_ids else '(none)'}={actual_raw:.6f}"
            )

    return counts


def evaluate_end_to_end() -> dict[str, int]:
    """Evaluate the production embedding plus reranking recommendation flow."""
    counts = {"hit@1": 0, "hit@3": 0, "hit@6": 0}

    print("\nRunning end-to-end recommendation evaluation...\n")
    for case in TEST_CASES:
        expected_ids = set(case["expected_frame_ids"])
        returned_frames = get_ranked_frames(case["session"])
        returned_ids = [frame["id"] for frame in returned_frames]
        hits = {
            "hit@1": bool(returned_ids and returned_ids[0] == case["expected_frame_ids"][0]),
            "hit@3": bool(set(returned_ids[:3]) & expected_ids),
            "hit@6": bool(set(returned_ids[:6]) & expected_ids),
        }
        for metric, hit in hits.items():
            counts[metric] += int(hit)
        status = "PASS" if hits["hit@6"] else "FAIL"
        print(f"{status:<4} {case['name']}: {returned_ids}")

    total = len(TEST_CASES)
    print("\nEnd-to-end summary")
    print("------------------")
    for metric in ("hit@1", "hit@3", "hit@6"):
        print(f"{metric}: {counts[metric]}/{total} ({counts[metric] / total:.1%})")
    return counts


def print_comparison_table(
    embedding_counts: dict[str, int],
    end_to_end_counts: dict[str, int],
    random_rates: dict[str, float],
) -> None:
    """Print all evaluation methods side by side."""
    total = len(TEST_CASES)
    print("\nComparison")
    print("----------")
    print(f"{'method':<34} {'hit@1':>10} {'hit@3':>10} {'hit@6':>10}")
    print("-" * 68)
    embedding_rates = {
        metric: embedding_counts[metric] / total for metric in embedding_counts
    }
    end_to_end_rates = {
        metric: end_to_end_counts[metric] / total for metric in end_to_end_counts
    }
    rows = [
        ("Random baseline", random_rates),
        ("Embedding-only", embedding_rates),
        ("End-to-end (embedding+rerank)", end_to_end_rates),
    ]
    for method, rates in rows:
        print(
            f"{method:<34} "
            f"{rates['hit@1']:>9.1%} "
            f"{rates['hit@3']:>9.1%} "
            f"{rates['hit@6']:>9.1%}"
        )


if __name__ == "__main__":
    random_rates = evaluate_random_baseline()
    embedding_counts = evaluate()
    end_to_end_counts = evaluate_end_to_end()
    print_comparison_table(embedding_counts, end_to_end_counts, random_rates)