
export interface MatchRequest {
  p1_name: string;
  p1_mbti: string;
  p1_career: string;
  p1_values: string;
  p2_name: string;
  p2_mbti: string;
  p2_career: string;
  p2_values: string;
}

export interface MatchDimension {
  name: string;
  description: string;
  score: number;
  max_score: number;
  insight: string;
}

export interface MatchResponse {
  total_score: number;
  max_total: number;
  conclusion: string;
  dimensions: MatchDimension[];
}

export const getCompatibilityMatch = async (data: MatchRequest): Promise<MatchResponse> => {
  const response = await fetch('/api/ai/compatibility', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'AI comparison failed.');
  return payload as MatchResponse;
};
