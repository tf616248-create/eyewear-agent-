import re


def _parse_budget(value: object) -> tuple[float, float | None] | None:
    """Parse a budget into its lower bound and optional upper bound."""
    if not isinstance(value, str):
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return 0.0, float(value)
        return None

    numbers = re.findall(r"\d+(?:[.,]\d+)?", value)
    if not numbers:
        return None

    try:
        parsed = [float(number.replace(",", ".")) for number in numbers]
    except (TypeError, ValueError):
        return None

    if len(parsed) >= 2:
        lower, upper = parsed[0], parsed[1]
        return (lower, upper) if lower <= upper else (upper, lower)
    return 0.0, parsed[0]


def rerank_frames(
    frames: list[dict],
    session: dict,
    rejected_ids: list[str]
) -> list[dict]:
    """
    מדרג מחדש את המסגרות לפי קריטריונים נוספים:
    - מלאי
    - התאמת תקציב
    - התאמת סגנון
    - התאמת צורת פנים
    """
    answers = session.get('answers', {})
    face_data = session.get('faceData', {})
    budget = answers.get('budget', '')
    style = answers.get('style', '')
    gender = answers.get('gender', '')
    face_shape = face_data.get('faceShape', '')

    def score_frame(frame: dict) -> float:
        score = 0.0

        # מסנן מסגרות שנדחו
        if frame['id'] in rejected_ids:
            return -1.0

        # מלאי — עדיפות למה שיש יותר ממנו
        stock = frame.get('stock', 0)
        if stock >= 6:
            score += 10
        elif stock >= 3:
            score += 5
        elif stock >= 1:
            score += 1

        # התאמת תקציב
        if budget == 'גמיש':
            score += 10
        else:
            user_budget = _parse_budget(budget)
            frame_budget = _parse_budget(frame.get('price', 0))
            if user_budget and frame_budget:
                user_min, user_max = user_budget
                frame_min, frame_max = frame_budget
                effective_user_max = user_max if user_max is not None else float('inf')
                effective_frame_max = frame_max if frame_max is not None else frame_min
                if user_min <= effective_frame_max and frame_min <= effective_user_max:
                    score += 20

        # התאמת סגנון — התאמה מדויקת
        frame_style = frame.get('style', '').lower()
        if style and style.lower() in frame_style:
            score += 25

        # התאמת צורת פנים
        face_shapes_match = frame.get('face_shapes_match', [])
        if face_shape and face_shape in face_shapes_match:
            score += 30

        # משקל — עדיפות לקל יותר
        weight = frame.get('weight', '')
        if weight == 'קל':
            score += 5
        elif weight == 'בינוני':
            score += 3

        # Gender is a preference, never a filter.
        if gender and (
            gender == frame.get('gender') or frame.get('gender') == 'יוניסקס'
        ):
            score += 10

        return score

    # מדרג ומסנן
    scored = [
        {"frame": f, "score": score_frame(f)}
        for f in frames
        if score_frame(f) >= 0  # מסיר מה שנדחה
    ]

    scored.sort(key=lambda x: x['score'], reverse=True)
    return [item['frame'] for item in scored]