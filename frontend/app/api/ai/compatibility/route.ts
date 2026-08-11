import { NextRequest, NextResponse } from 'next/server';

type Person = { name?: string; mbti?: string; career?: string; values?: string };
const person = (body: Record<string, unknown>, prefix: 'p1' | 'p2'): Person => ({
  name: String(body[`${prefix}_name`] ?? '').slice(0, 80),
  mbti: String(body[`${prefix}_mbti`] ?? '').slice(0, 20),
  career: String(body[`${prefix}_career`] ?? '').slice(0, 120),
  values: String(body[`${prefix}_values`] ?? '').slice(0, 120),
});

// MBTI compatibility scoring
const mbtiCompatibility: Record<string, Record<string, number>> = {
  'INTJ': { 'ENTP': 24, 'ENFP': 22, 'INTP': 20, 'INFJ': 19, 'INTJ': 15, 'ENTJ': 18, 'INFP': 17, 'ENFJ': 16, 'ISTJ': 12, 'ISFJ': 11, 'ESTJ': 10, 'ESFJ': 9, 'ISTP': 14, 'ISFP': 13, 'ESTP': 8, 'ESFP': 7 },
  'INTP': { 'ENTJ': 24, 'ENTP': 22, 'INTJ': 20, 'INFP': 19, 'INTP': 15, 'ENFP': 18, 'INFJ': 17, 'ENFJ': 16, 'ISTP': 14, 'ISFP': 13, 'ESTP': 12, 'ESFP': 11, 'ISTJ': 10, 'ISFJ': 9, 'ESTJ': 8, 'ESFJ': 7 },
  'ENTJ': { 'INTP': 24, 'INTJ': 22, 'ENTP': 20, 'ENFP': 19, 'ENTJ': 15, 'INFP': 18, 'INFJ': 17, 'ENFJ': 16, 'ESTJ': 14, 'ESFJ': 13, 'ISTJ': 12, 'ISFJ': 11, 'ESTP': 10, 'ESFP': 9, 'ISTP': 8, 'ISFP': 7 },
  'ENTP': { 'INTJ': 24, 'INFJ': 22, 'ENTP': 15, 'ENFP': 20, 'INTP': 20, 'ENTJ': 20, 'INFP': 18, 'ENFJ': 17, 'ESTP': 14, 'ESFP': 13, 'ISTP': 12, 'ISFP': 11, 'ESTJ': 10, 'ESFJ': 9, 'ISTJ': 8, 'ISFJ': 7 },
  'INFJ': { 'ENFP': 24, 'ENTP': 22, 'INFP': 20, 'INTJ': 19, 'INFJ': 15, 'ENFJ': 18, 'INTP': 17, 'ENTJ': 16, 'ISFJ': 14, 'ISTJ': 13, 'ESFJ': 12, 'ESTJ': 11, 'ISFP': 10, 'ISTP': 9, 'ESFP': 8, 'ESTP': 7 },
  'INFP': { 'ENFJ': 24, 'ENTJ': 22, 'INFJ': 20, 'INTP': 19, 'INFP': 15, 'ENFP': 18, 'INTJ': 17, 'ENTP': 16, 'ISFP': 14, 'ISTP': 13, 'ESFP': 12, 'ESTP': 11, 'ISFJ': 10, 'ISTJ': 9, 'ESFJ': 8, 'ESTJ': 7 },
  'ENFJ': { 'INFP': 24, 'ISFP': 22, 'ENFP': 20, 'INFJ': 19, 'ENFJ': 15, 'INTP': 18, 'INTJ': 17, 'ENTP': 16, 'ESFJ': 14, 'ESTJ': 13, 'ISFJ': 12, 'ISTJ': 11, 'ESFP': 10, 'ESTP': 9, 'ENTJ': 8, 'ISTP': 7 },
  'ENFP': { 'INFJ': 24, 'INTJ': 22, 'ENFJ': 20, 'INFP': 19, 'ENFP': 15, 'ENTP': 18, 'INTP': 17, 'ENTJ': 16, 'ESFP': 14, 'ESTP': 13, 'ISFP': 12, 'ISTP': 11, 'ESFJ': 10, 'ESTJ': 9, 'ISFJ': 8, 'ISTJ': 7 },
  'ISTJ': { 'ESFP': 24, 'ESTP': 22, 'ISFJ': 20, 'ISTJ': 15, 'ESTJ': 18, 'ESFJ': 17, 'INTJ': 12, 'ENTJ': 10, 'INTP': 10, 'ENTP': 8, 'INFJ': 13, 'ENFJ': 11, 'INFP': 9, 'ENFP': 8, 'ISTP': 14, 'ISFP': 13 },
  'ISFJ': { 'ESFP': 24, 'ESTP': 22, 'ISTJ': 20, 'ISFJ': 15, 'ESFJ': 18, 'ESTJ': 17, 'INFJ': 14, 'ENFJ': 12, 'INTJ': 11, 'ENTJ': 11, 'INFP': 10, 'ENFP': 8, 'INTP': 9, 'ENTP': 7, 'ISTP': 13, 'ISFP': 14 },
  'ESTJ': { 'INTP': 24, 'ISTP': 22, 'ENTJ': 20, 'ESTJ': 15, 'ISTJ': 18, 'ESFJ': 17, 'INTJ': 10, 'ENTP': 10, 'INFP': 8, 'ENFP': 9, 'INFJ': 11, 'ENFJ': 13, 'ESTP': 14, 'ESFP': 13 },
  'ESFJ': { 'INFP': 24, 'ISFP': 22, 'ENFJ': 20, 'ESFJ': 15, 'ISFJ': 18, 'ESTJ': 17, 'INFJ': 12, 'ENFP': 10, 'INTJ': 9, 'ENTJ': 13, 'INTP': 7, 'ENTP': 9, 'ISTJ': 11, 'ESTP': 14, 'ISTP': 8, 'ESFP': 14 },
  'ISTP': { 'ESTJ': 24, 'ENTJ': 22, 'ISTP': 15, 'ISFP': 20, 'ESTP': 18, 'ESFP': 17, 'INTJ': 14, 'ENTP': 12, 'INTP': 14, 'ENFP': 11, 'INFJ': 9, 'ENFJ': 8, 'INFP': 13, 'ISTJ': 14, 'ISFJ': 13, 'ESFJ': 8 },
  'ISFP': { 'ENFJ': 24, 'ESFJ': 22, 'ISFP': 15, 'ISTP': 20, 'ESFP': 18, 'ESTP': 17, 'INFJ': 10, 'ENFP': 12, 'INTJ': 13, 'ENTJ': 7, 'INFP': 14, 'ENTP': 11, 'INTP': 13, 'ISTJ': 13, 'ISFJ': 14, 'ESTJ': 7 },
  'ESTP': { 'ISTJ': 24, 'ISFJ': 22, 'ESTP': 15, 'ESFP': 20, 'ISTP': 18, 'ESTJ': 14, 'INTJ': 8, 'ENTJ': 10, 'INTP': 12, 'ENTP': 14, 'INFJ': 7, 'ENFJ': 9, 'INFP': 11, 'ENFP': 13, 'ISFP': 17, 'ESFJ': 14 },
  'ESFP': { 'ISTJ': 24, 'ISFJ': 22, 'ESFP': 15, 'ESTP': 20, 'ISFP': 18, 'ESTJ': 13, 'INTJ': 7, 'ENTJ': 9, 'INTP': 11, 'ENTP': 13, 'INFJ': 8, 'ENFJ': 10, 'INFP': 12, 'ENFP': 14, 'ISTP': 17, 'ESFJ': 14 },
};

// Career compatibility
const careerCompatibility: Record<string, Record<string, number>> = {
  'Engineering/Tech': { 'Engineering/Tech': 20, 'Medicine/Healthcare': 15, 'Business/Finance': 18, 'Arts/Design': 10, 'Education': 14, 'Law': 12, 'Science/Research': 22 },
  'Medicine/Healthcare': { 'Engineering/Tech': 15, 'Medicine/Healthcare': 20, 'Business/Finance': 14, 'Arts/Design': 12, 'Education': 18, 'Law': 10, 'Science/Research': 22 },
  'Business/Finance': { 'Engineering/Tech': 18, 'Medicine/Healthcare': 14, 'Business/Finance': 20, 'Arts/Design': 10, 'Education': 12, 'Law': 16, 'Science/Research': 15 },
  'Arts/Design': { 'Engineering/Tech': 10, 'Medicine/Healthcare': 12, 'Business/Finance': 10, 'Arts/Design': 20, 'Education': 18, 'Law': 8, 'Science/Research': 14 },
  'Education': { 'Engineering/Tech': 14, 'Medicine/Healthcare': 18, 'Business/Finance': 12, 'Arts/Design': 18, 'Education': 20, 'Law': 14, 'Science/Research': 16 },
  'Law': { 'Engineering/Tech': 12, 'Medicine/Healthcare': 10, 'Business/Finance': 16, 'Arts/Design': 8, 'Education': 14, 'Law': 20, 'Science/Research': 10 },
  'Science/Research': { 'Engineering/Tech': 22, 'Medicine/Healthcare': 22, 'Business/Finance': 15, 'Arts/Design': 14, 'Education': 16, 'Law': 10, 'Science/Research': 20 },
};

// Values compatibility
const valuesCompatibility: Record<string, Record<string, number>> = {
  'Family First': { 'Family First': 25, 'Career Ambition': 15, 'Adventure & Travel': 10, 'Spiritual Growth': 22, 'Community Impact': 20, 'Financial Independence': 12 },
  'Career Ambition': { 'Family First': 15, 'Career Ambition': 25, 'Adventure & Travel': 18, 'Spiritual Growth': 10, 'Community Impact': 14, 'Financial Independence': 22 },
  'Adventure & Travel': { 'Family First': 10, 'Career Ambition': 18, 'Adventure & Travel': 25, 'Spiritual Growth': 16, 'Community Impact': 20, 'Financial Independence': 15 },
  'Spiritual Growth': { 'Family First': 22, 'Career Ambition': 10, 'Adventure & Travel': 16, 'Spiritual Growth': 25, 'Community Impact': 20, 'Financial Independence': 8 },
  'Community Impact': { 'Family First': 20, 'Career Ambition': 14, 'Adventure & Travel': 20, 'Spiritual Growth': 20, 'Community Impact': 25, 'Financial Independence': 12 },
  'Financial Independence': { 'Family First': 12, 'Career Ambition': 22, 'Adventure & Travel': 15, 'Spiritual Growth': 8, 'Community Impact': 12, 'Financial Independence': 25 },
};

function getScore(matrix: Record<string, Record<string, number>>, a: string, b: string): number {
  return matrix[a]?.[b] ?? matrix[b]?.[a] ?? 10;
}

function getInsight(dimension: string, score: number, p1: Person, p2: Person): string {
  if (score >= 22) {
    const insights: Record<string, string> = {
      'Personality Style': `${p1.name} and ${p2.name} share highly complementary personality traits that create natural understanding and balance in their interactions.`,
      'Career rhythm': `Both ${p1.name} and ${p2.name} have career paths that align well, suggesting mutual respect for each other's professional ambitions.`,
      'Shared values': `${p1.name} and ${p2.name} share very similar core values, forming a strong foundation for a lasting relationship.`,
      'Conversation starters': `${p1.name} and ${p2.name} are likely to enjoy deep, engaging conversations across many topics.`,
    };
    return insights[dimension] || 'Strong compatibility in this area.';
  } else if (score >= 16) {
    const insights: Record<string, string> = {
      'Personality Style': `${p1.name} and ${p2.name} have compatible personality styles that can complement each other well with mutual effort.`,
      'Career rhythm': `${p1.name} and ${p2.name} have reasonably aligned career perspectives that can support a balanced partnership.`,
      'Shared values': `${p1.name} and ${p2.name} share several common values, providing a good basis for understanding each other.`,
      'Conversation starters': `${p1.name} and ${p2.name} have enough common ground for interesting conversations and shared activities.`,
    };
    return insights[dimension] || 'Moderate compatibility in this area.';
  } else {
    const insights: Record<string, string> = {
      'Personality Style': `${p1.name} and ${p2.name} have different personality approaches that may require patience and understanding to bridge.`,
      'Career rhythm': `${p1.name} and ${p2.name} have different career focuses that may need open communication to harmonize.`,
      'Shared values': `${p1.name} and ${p2.name} have differing core values that may require discussion to find common ground.`,
      'Conversation starters': `${p1.name} and ${p2.name} may need to explore new shared interests to build conversational connection.`,
    };
    return insights[dimension] || 'Different approaches in this area - communication is key.';
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;
  const first = person(body, 'p1');
  const second = person(body, 'p2');

  if (!first.name || !second.name) {
    return NextResponse.json({ error: 'Both names are required.' }, { status: 400 });
  }

  // Manual compatibility scoring
  const personalityScore = getScore(mbtiCompatibility, first.mbti || 'INTJ', second.mbti || 'ENFP');
  const careerScore = getScore(careerCompatibility, first.career || 'Engineering/Tech', second.career || 'Arts/Design');
  const valuesScore = getScore(valuesCompatibility, first.values || 'Family First', second.values || 'Adventure & Travel');
  const conversationScore = Math.round((personalityScore + valuesScore) / 2);

  const totalScore = personalityScore + careerScore + valuesScore + conversationScore;
  const maxTotal = 100;

  let conclusion = '';
  if (totalScore >= 80) {
    conclusion = `${first.name} and ${second.name} show strong compatibility across multiple dimensions. Their personalities, career perspectives, and core values align well, suggesting a promising foundation for a meaningful relationship. With mutual respect and open communication, this pairing has great potential.`;
  } else if (totalScore >= 60) {
    conclusion = `${first.name} and ${second.name} have moderate compatibility with several areas of alignment. While there are differences in some dimensions, these can be bridges to deeper understanding with effort and communication. Focus on shared values to strengthen the connection.`;
  } else {
    conclusion = `${first.name} and ${second.name} have differing profiles across key dimensions. Compatibility is possible but may require significant understanding, patience, and willingness to appreciate each other's unique perspectives. Open dialogue about differences is recommended.`;
  }

  const result = {
    total_score: totalScore,
    max_total: maxTotal,
    conclusion,
    dimensions: [
      {
        name: 'Personality Style',
        description: 'How MBTI types interact and complement each other',
        score: personalityScore,
        max_score: 25,
        insight: getInsight('Personality Style', personalityScore, first, second),
      },
      {
        name: 'Career rhythm',
        description: 'Alignment of professional paths and ambitions',
        score: careerScore,
        max_score: 25,
        insight: getInsight('Career rhythm', careerScore, first, second),
      },
      {
        name: 'Shared values',
        description: 'Core life values and what matters most',
        score: valuesScore,
        max_score: 25,
        insight: getInsight('Shared values', valuesScore, first, second),
      },
      {
        name: 'Conversation starters',
        description: 'Natural topics and communication flow',
        score: conversationScore,
        max_score: 25,
        insight: getInsight('Conversation starters', conversationScore, first, second),
      },
    ],
  };

  return NextResponse.json(result);
}
