from prompts.guidelines import PROFESSIONAL_GUIDELINES
from prompts.few_shot import FEW_SHOT_EXAMPLES


def build_recommendation_prompt(session: dict, relevant_frames: list) -> str:
    # שימוש ב-.get() מאובטח לכל השדות של המסגרת למניעת KeyError
    inventory_items = []
    for f in relevant_frames:
        face_shapes = f.get('face_shapes_match', [])
        face_shapes_str = ', '.join(face_shapes) if isinstance(face_shapes, list) else str(face_shapes)
        
        # תמיכה גמישה במפתח המחיר (בודק price או price_ils או Price)
        price = f.get('price') or f.get('price_ils') or f.get('Price', 0)

        item_text = f"""
ID: {f.get('id', 'unknown')}
Name: {f.get('name', 'unknown')}
Shape: {f.get('shape', 'unknown')}
Color: {f.get('color', 'unknown')}
Material: {f.get('material', 'unknown')}
Size: {f.get('size', 'unknown')}
Style: {f.get('style', 'unknown')}
Price: {price}₪
Suitable for face shapes: {face_shapes_str}
Weight: {f.get('weight', 'unknown')}
Description: {f.get('description', '')}
Stock: {f.get('stock', 0)}
        """.strip()
        inventory_items.append(item_text)

    inventory_text = "\n---\n".join(inventory_items)

    face_data = session.get('faceData', {})
    answers = session.get('answers', {})
    previous_frame = session.get('previousFrame')

    previous_text = ""
    if previous_frame and isinstance(previous_frame, dict):
        liked = "Yes" if previous_frame.get('liked') else "No"
        reason = previous_frame.get('reason', '')
        previous_text = f"""
=== Previous Glasses ===
Customer had previous glasses.
Liked them: {liked}
Reason for replacing: {reason}
        """.strip()
    else:
        previous_text = "Customer has no previous glasses."

    rejected_ids = session.get('rejectedFrameIds', [])
    rejected_text = (
        f"Already rejected in this session (DO NOT suggest): {', '.join(rejected_ids)}"
        if rejected_ids
        else "No frames rejected yet."
    )

    prompt = f"""
{PROFESSIONAL_GUIDELINES}

{FEW_SHOT_EXAMPLES}

=== Customer Data ===
Face shape: {face_data.get('faceShape', 'unknown')}
Face ratio (height/width): {face_data.get('ratio', 'unknown')}
Face width: {face_data.get('faceWidth', 'unknown')}px
Face height: {face_data.get('faceHeight', 'unknown')}px
Usage: {answers.get('usage', 'unknown')}
Budget: {answers.get('budget', 'unknown')}
Preferred style: {answers.get('style', 'unknown')}

{previous_text}

{rejected_text}

=== Available Inventory ===
{inventory_text}

=== Instructions ===
The frames listed above have already been selected and ordered by the embedding and re-ranking pipeline.
Do not choose, filter, reorder, replace, or add frames.
Write a natural, warm Hebrew explanation for each listed frame, using its matching ID only to associate the explanation.
Return one reason for every listed frame, including frames that are not an ideal match.

Return JSON only, no extra text:
{{
    "reasons": [
    {{ "id": "frame_xxx", "reason": "הסבר מקצועי ואנושי בעברית" }},
    {{ "id": "frame_xxx", "reason": "הסבר מקצועי ואנושי בעברית" }},
    {{ "id": "frame_xxx", "reason": "הסבר מקצועי ואנושי בעברית" }}
  ]
}}
    """.strip()

    return prompt


def build_chat_prompt(
    user_message: str,
    session: dict,
    chat_history: list,
    rejected_ids: list
) -> str:
    face_data = session.get('faceData', {})
    answers = session.get('answers', {})
    recommendations = session.get('recommendations', [])
    recommendations = recommendations[:3] if isinstance(recommendations, list) else []

    recommended_items = []
    if isinstance(recommendations, list):
        for r in recommendations:
            if isinstance(r, dict):
                price = r.get('price') or r.get('price_ils') or r.get('Price', 0)
                face_shapes = r.get('face_shapes_match', [])
                face_shapes_text = ', '.join(face_shapes) if isinstance(face_shapes, list) else str(face_shapes)
                recommended_items.append(
                    f"- ID: {r.get('id', 'unknown')}; "
                    f"Name: {r.get('name', 'unknown')}; "
                    f"Shape: {r.get('shape', 'unknown')}; "
                    f"Color: {r.get('color', 'unknown')}; "
                    f"Material: {r.get('material', 'unknown')}; "
                    f"Style: {r.get('style', 'unknown')}; "
                    f"Price: {price}₪; "
                    f"Suitable face shapes: {face_shapes_text}; "
                    f"Weight: {r.get('weight', 'unknown')}; "
                    f"Reason shown: {r.get('reason', '')}"
                )

    recommended_text = "\n".join(recommended_items)

    history_text = "\n".join([
        f"{'Customer' if m.get('role') == 'user' else 'Optician'}: {m.get('content', '')}"
        for m in chat_history
        if isinstance(m, dict)
    ])

    rejected_text = (
        f"Already rejected (DO NOT suggest): {', '.join(rejected_ids)}"
        if rejected_ids
        else "No frames rejected yet."
    )

    prompt = f"""
{PROFESSIONAL_GUIDELINES}

=== Session Context ===
Face shape: {face_data.get('faceShape', 'unknown')}
Usage: {answers.get('usage', 'unknown')}
Budget: {answers.get('budget', 'unknown')}
Style: {answers.get('style', 'unknown')}

=== Recommended Frames ===
{recommended_text or 'None yet'}

=== Rejected Frames ===
{rejected_text}

=== Conversation History ===
{history_text or 'No history yet'}

=== Customer Message ===
{user_message}

=== Instructions ===
- Respond in Hebrew only, naturally and warmly
- Keep response to 2-3 sentences maximum
- If customer wants a change — suggest a different frame from inventory
- If customer is ready to buy — tell them to click "המשך לרכישה"
- After 4 rounds without decision — ask a clarifying question
- NEVER suggest rejected frames
    """.strip()

    return prompt