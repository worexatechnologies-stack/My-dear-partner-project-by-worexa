def hash_string(s: str) -> int:
    """
    Python implementation of JavaScript's string hashing code:
    hash = charCode + ((hash << 5) - hash)
    Kept within signed 32-bit integer bounds.
    """
    hash_val = 0
    for char in s:
        char_code = ord(char)
        # Shift and subtract, mimicking JS bitwise operations
        hash_val = char_code + ((hash_val << 5) - hash_val)
        # Cast to signed 32-bit integer
        hash_val = (hash_val + 2**31) % 2**32 - 2**31
    return abs(hash_val)

def calculate_compatibility(data: dict) -> dict:
    """
    Matches the deterministic matching dimension calculations.
    """
    p1_name = data.get('p1_name', '')
    p2_name = data.get('p2_name', '')
    p1_mbti = data.get('p1_mbti', '')
    p2_mbti = data.get('p2_mbti', '')
    p1_career = data.get('p1_career', '')
    p2_career = data.get('p2_career', '')
    p1_values = data.get('p1_values', '')
    p2_values = data.get('p2_values', '')

    combined_str = p1_name + p2_name + p1_mbti + p2_mbti + p1_career + p2_career + p1_values + p2_values
    combined_hash = hash_string(combined_str)

    dimensions = [
        {
            'name': 'Personality Compatibility',
            'description': 'Alignment of core personality traits (MBTI profile).',
            'score': 15 + (combined_hash % 10),
            'max_score': 25,
            'insight': f"The interaction between {p1_mbti} and {p2_mbti} indicates a complementary dynamic with strong communication pathways.",
        },
        {
            'name': 'Career & Ambition Synergy',
            'description': 'Compatibility of professional trajectories and ambitions.',
            'score': 18 + ((combined_hash >> 2) % 7),
            'max_score': 25,
            'insight': f"Balancing {p1_career} with {p2_career} provides a stable foundation for mutual growth and shared goals.",
        },
        {
            'name': 'Core Values Alignment',
            'description': 'Shared fundamental beliefs and long-term life goals.',
            'score': 20 + ((combined_hash >> 4) % 5),
            'max_score': 25,
            'insight': "High synchronization detected in primary life values, suggesting long-term ideological harmony and shared purpose.",
        },
        {
            'name': 'Emotional Intelligence',
            'description': 'Predicted conflict resolution capacity and empathy levels.',
            'score': 17 + ((combined_hash >> 6) % 8),
            'max_score': 25,
            'insight': "Compatibility models predict high emotional bandwidth, enabling mature navigation of complex life situations together.",
        },
    ]

    total_score = sum(dim['score'] for dim in dimensions)

    if total_score >= 90:
        conclusion = (
            'EXCEPTIONAL MATCH: Our compatibility engine has identified a profound alignment '
            'across all psychological and foundational vectors. This pairing exhibits ultra-high '
            'long-term compatibility indicators with strong foundations for a lasting relationship.'
        )
    elif total_score >= 75:
        conclusion = (
            'STRONG MATCH: The personality and lifestyle models suggest a highly compatible '
            'relationship with excellent foundations for mutual growth, understanding, and a '
            'fulfilling life together.'
        )
    else:
        conclusion = (
            'GOOD MATCH: While strong foundational alignment exists, our engine detects some '
            'areas requiring conscious communication and intentional effort to bridge differences '
            'and build lasting harmony.'
        )

    return {
        'total_score': total_score,
        'max_total': 100,
        'conclusion': conclusion,
        'dimensions': dimensions
    }
