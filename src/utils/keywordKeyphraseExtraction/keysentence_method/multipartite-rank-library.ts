import kuromoji from "kuromoji";

/**
 * MultipartiteRank Algorithm for Key Sentence Extraction
 *
 * Based on the paper: "Unsupervised Keyphrase Extraction with Multipartite Graphs"
 * by Florian Boudin (2018)
 * Adapted for sentence-level extraction
 *
 * This algorithm builds a multipartite graph where:
 * 1. Sentence candidates are grouped into topics
 * 2. Only sentences from different topics are connected
 * 3. TextRank algorithm is applied with position-based weight adjustment
 */

interface Candidate {
  sentence: string;
  position: number;
  keywords: string[];
  topicId: number;
}

interface GraphEdge {
  from: number;
  to: number;
  weight: number;
}

interface ClusterData {
  candidates: Candidate[];
  centroid: string[];
}

/**
 * Split text into sentences
 */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/[。！？\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10); // Minimum sentence length
}

/**
 * Extract keywords from a sentence using POS patterns
 */
function extractKeywordsFromSentence(
  sentence: string,
  tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures>
): string[] {
  const tokens = tokenizer.tokenize(sentence);
  const keywords: string[] = [];
  const keywordSet = new Set<string>();

  let currentPhrase: string[] = [];

  for (const token of tokens) {
    const pos = token.pos;
    const surface = token.surface_form;

    // Check if token is adjective or noun
    const isAdjective = pos.startsWith("形容詞");
    const isNoun =
      pos.startsWith("名詞") &&
      !pos.includes("代名詞") &&
      !pos.includes("非自立");

    if (isAdjective || isNoun) {
      currentPhrase.push(surface);

      // If current token is noun, we might have a complete phrase
      if (isNoun && currentPhrase.length >= 1) {
        const phrase = currentPhrase.join("");
        if (phrase.length >= 2 && !keywordSet.has(phrase)) {
          keywords.push(phrase);
          keywordSet.add(phrase);
        }
      }
    } else {
      // Reset current phrase
      currentPhrase = [];
    }
  }

  return keywords;
}

/**
 * Extract sentence candidates with their keywords
 */
function extractCandidates(
  text: string,
  tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures>
): Candidate[] {
  const sentences = splitIntoSentences(text);
  const candidates: Candidate[] = [];

  sentences.forEach((sentence, index) => {
    const keywords = extractKeywordsFromSentence(sentence, tokenizer);

    if (keywords.length > 0) {
      candidates.push({
        sentence,
        position: index,
        keywords,
        topicId: -1, // Will be assigned during clustering
      });
    }
  });

  return candidates;
}

/**
 * Compute similarity between two sentences based on shared keywords
 */
function computeSimilarity(
  candidate1: Candidate,
  candidate2: Candidate
): number {
  const keywords1 = new Set(candidate1.keywords);
  const keywords2 = new Set(candidate2.keywords);

  const intersection = new Set([...keywords1].filter((x) => keywords2.has(x)));
  const union = new Set([...keywords1, ...keywords2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Hierarchical agglomerative clustering with average linkage
 */
function clusterCandidates(
  candidates: Candidate[],
  threshold: number = 0.25
): Candidate[] {
  if (candidates.length === 0) return candidates;

  // Initialize each candidate as its own cluster
  const clusters: ClusterData[] = candidates.map((candidate) => ({
    candidates: [{ ...candidate }],
    centroid: candidate.keywords,
  }));

  // Compute initial similarity matrix
  const similarities: number[][] = [];
  for (let i = 0; i < clusters.length; i++) {
    similarities[i] = [];
    for (let j = 0; j < clusters.length; j++) {
      if (i === j) {
        similarities[i][j] = 0;
      } else {
        similarities[i][j] = computeSimilarity(candidates[i], candidates[j]);
      }
    }
  }

  // Merge clusters iteratively
  while (true) {
    // Find highest similarity pair
    let maxSim = -1;
    let mergeI = -1,
      mergeJ = -1;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        if (similarities[i][j] > maxSim) {
          maxSim = similarities[i][j];
          mergeI = i;
          mergeJ = j;
        }
      }
    }

    // Stop if no similarity above threshold
    if (maxSim < threshold || mergeI === -1) break;

    // Merge clusters
    const newCluster: ClusterData = {
      candidates: [
        ...clusters[mergeI].candidates,
        ...clusters[mergeJ].candidates,
      ],
      centroid: [
        ...new Set([
          ...clusters[mergeI].centroid,
          ...clusters[mergeJ].centroid,
        ]),
      ],
    };

    // Update similarity matrix
    const newSimilarities: number[][] = [];
    const newClusters: ClusterData[] = [];

    for (let i = 0; i < clusters.length; i++) {
      if (i !== mergeI && i !== mergeJ) {
        newClusters.push(clusters[i]);
      }
    }
    newClusters.push(newCluster);

    // Recompute similarities
    for (let i = 0; i < newClusters.length; i++) {
      newSimilarities[i] = [];
      for (let j = 0; j < newClusters.length; j++) {
        if (i === j) {
          newSimilarities[i][j] = 0;
        } else {
          // Average linkage: compute average similarity between all pairs
          let totalSim = 0;
          let count = 0;
          for (const c1 of newClusters[i].candidates) {
            for (const c2 of newClusters[j].candidates) {
              totalSim += computeSimilarity(c1, c2);
              count++;
            }
          }
          newSimilarities[i][j] = count > 0 ? totalSim / count : 0;
        }
      }
    }

    similarities.length = 0;
    similarities.push(...newSimilarities);
    clusters.length = 0;
    clusters.push(...newClusters);
  }

  // Assign topic IDs
  const result: Candidate[] = [];
  clusters.forEach((cluster, topicId) => {
    cluster.candidates.forEach((candidate) => {
      result.push({
        ...candidate,
        topicId,
      });
    });
  });

  return result;
}

/**
 * Build multipartite graph with edge weights based on keyword overlap and position distance
 */
function buildMultipartiteGraph(candidates: Candidate[]): GraphEdge[] {
  const edges: GraphEdge[] = [];

  for (let i = 0; i < candidates.length; i++) {
    for (let j = 0; j < candidates.length; j++) {
      if (i === j) continue;

      const candidate1 = candidates[i];
      const candidate2 = candidates[j];

      // Only connect candidates from different topics
      if (candidate1.topicId !== candidate2.topicId) {
        // Calculate keyword similarity weight
        const keywordSimilarity = computeSimilarity(candidate1, candidate2);

        // Calculate position distance weight
        const positionDistance = Math.abs(
          candidate1.position - candidate2.position
        );
        const positionWeight =
          positionDistance > 0 ? 1.0 / positionDistance : 1.0;

        // Combine weights
        const weight = keywordSimilarity * positionWeight;

        if (weight > 0) {
          edges.push({
            from: i,
            to: j,
            weight,
          });
        }
      }
    }
  }

  return edges;
}

/**
 * Apply position-based weight adjustment
 * Promotes sentences that occur first in each topic
 */
function adjustWeights(
  edges: GraphEdge[],
  candidates: Candidate[],
  alpha: number = 1.1
): GraphEdge[] {
  // Find first occurring candidate for each topic
  const topicFirstCandidates = new Map<number, number>();

  candidates.forEach((candidate, idx) => {
    const currentFirst = topicFirstCandidates.get(candidate.topicId);

    if (currentFirst === undefined) {
      topicFirstCandidates.set(candidate.topicId, idx);
    } else {
      const currentFirstPos = candidates[currentFirst].position;
      if (candidate.position < currentFirstPos) {
        topicFirstCandidates.set(candidate.topicId, idx);
      }
    }
  });

  const adjustedEdges = [...edges];

  // Adjust incoming weights for first candidates
  topicFirstCandidates.forEach((firstCandidateIdx) => {
    const firstCandidate = candidates[firstCandidateIdx];

    // Calculate adjustment factor
    const positionBoost = Math.exp(1.0 / (firstCandidate.position + 1)); // +1 to avoid division by zero

    // Sum of outgoing weights from same-topic candidates
    let sameTopicOutgoingSum = 0;
    candidates.forEach((candidate, idx) => {
      if (
        candidate.topicId === firstCandidate.topicId &&
        idx !== firstCandidateIdx
      ) {
        edges.forEach((edge) => {
          if (edge.from === idx) {
            sameTopicOutgoingSum += edge.weight;
          }
        });
      }
    });

    // Adjust incoming edges to first candidate
    adjustedEdges.forEach((edge) => {
      if (edge.to === firstCandidateIdx) {
        edge.weight += alpha * positionBoost * sameTopicOutgoingSum;
      }
    });
  });

  return adjustedEdges;
}

/**
 * TextRank algorithm for weighted directed graphs
 */
function textRank(
  candidates: Candidate[],
  edges: GraphEdge[],
  damping: number = 0.85,
  iterations: number = 100,
  tolerance: number = 1e-6
): number[] {
  const n = candidates.length;
  if (n === 0) return [];

  // Initialize scores
  let scores = new Array(n).fill(1.0);

  // Build adjacency information
  const incomingEdges = new Map<number, GraphEdge[]>();
  const outgoingWeights = new Map<number, number>();

  for (let i = 0; i < n; i++) {
    incomingEdges.set(i, []);
    outgoingWeights.set(i, 0);
  }

  edges.forEach((edge) => {
    incomingEdges.get(edge.to)!.push(edge);
    outgoingWeights.set(
      edge.from,
      outgoingWeights.get(edge.from)! + edge.weight
    );
  });

  // Iterative computation
  for (let iter = 0; iter < iterations; iter++) {
    const newScores = new Array(n);
    let maxChange = 0;

    for (let i = 0; i < n; i++) {
      let score = 1.0 - damping;

      const incoming = incomingEdges.get(i)!;
      for (const edge of incoming) {
        const outWeight = outgoingWeights.get(edge.from)!;
        if (outWeight > 0) {
          score += (damping * (edge.weight * scores[edge.from])) / outWeight;
        }
      }

      newScores[i] = score;
      maxChange = Math.max(maxChange, Math.abs(score - scores[i]));
    }

    scores = newScores;

    if (maxChange < tolerance) {
      break;
    }
  }

  return scores;
}

/**
 * Remove similar sentences based on content similarity
 */
function removeSimilarSentences(
  sentences: Array<{ sentence: string; score: number }>,
  threshold: number = 0.8
): Array<{ sentence: string; score: number }> {
  const result: Array<{ sentence: string; score: number }> = [];

  for (const candidate of sentences) {
    let isSimilar = false;

    for (const existing of result) {
      const longer =
        candidate.sentence.length > existing.sentence.length
          ? candidate.sentence
          : existing.sentence;
      const shorter =
        candidate.sentence.length <= existing.sentence.length
          ? candidate.sentence
          : existing.sentence;

      // Check if shorter sentence is contained in longer sentence
      if (longer.includes(shorter.substring(0, Math.min(20, shorter.length)))) {
        const similarity = shorter.length / longer.length;
        if (similarity >= threshold) {
          isSimilar = true;
          break;
        }
      }

      // Check character-level similarity
      const maxLen = Math.max(
        candidate.sentence.length,
        existing.sentence.length
      );
      const minLen = Math.min(
        candidate.sentence.length,
        existing.sentence.length
      );
      if (minLen / maxLen >= threshold) {
        isSimilar = true;
        break;
      }
    }

    if (!isSimilar) {
      result.push(candidate);
    }
  }

  return result;
}

/**
 * Main MultipartiteRank key sentence extraction function
 */
export async function extractKeyphrasesWithMultipartiteRank(
  text: string
): Promise<string[]> {
  try {
    console.log("🚀 Starting MultipartiteRank key sentence extraction...");

    // Initialize kuromoji tokenizer
    const tokenizer = await new Promise<
      kuromoji.Tokenizer<kuromoji.IpadicFeatures>
    >((resolve, reject) => {
      kuromoji
        .builder({ dicPath: "node_modules/kuromoji/dict" })
        .build((err, tokenizer) => {
          if (err) reject(err);
          else resolve(tokenizer);
        });
    });

    console.log(`📝 Input text length: ${text.length} characters`);

    // Extract sentence candidates
    const candidates = extractCandidates(text, tokenizer);
    console.log(`🎯 Extracted ${candidates.length} sentence candidates`);

    if (candidates.length === 0) {
      console.log("⚠️ No sentence candidates found");
      return [];
    }

    // Cluster candidates into topics
    const clusteredCandidates = clusterCandidates(candidates, 0.25);
    const topicCount = new Set(clusteredCandidates.map((c) => c.topicId)).size;
    console.log(`🏷️ Clustered into ${topicCount} topics`);

    if (clusteredCandidates.length === 0) {
      console.log("⚠️ No candidates after clustering");
      return [];
    }

    // Build multipartite graph
    const edges = buildMultipartiteGraph(clusteredCandidates);
    console.log(`🕸️ Built graph with ${edges.length} edges`);

    if (edges.length === 0) {
      console.log("⚠️ No edges in graph, using position-based fallback");
      // Fallback: return sentences based on position and keyword count
      return clusteredCandidates
        .sort(
          (a, b) =>
            b.keywords.length - a.keywords.length || a.position - b.position
        )
        .slice(0, 20)
        .map((candidate) => candidate.sentence);
    }

    // Apply weight adjustment
    const adjustedEdges = adjustWeights(edges, clusteredCandidates, 1.1);
    console.log(`⚖️ Applied position-based weight adjustment`);

    // Apply TextRank algorithm
    const scores = textRank(clusteredCandidates, adjustedEdges);
    console.log(`📊 Computed TextRank scores`);

    if (scores.length === 0) {
      console.log("⚠️ No scores computed");
      return [];
    }

    // Combine candidates with scores
    const scoredSentences = clusteredCandidates.map((candidate, idx) => ({
      sentence: candidate.sentence,
      score: scores[idx] || 0,
      position: candidate.position,
      topicId: candidate.topicId,
      keywordCount: candidate.keywords.length,
    }));

    // Sort by score
    scoredSentences.sort((a, b) => b.score - a.score);

    // Filter and select top sentences
    const filteredSentences = scoredSentences
      .filter((s) => s.sentence.length >= 10) // Minimum length
      .filter((s) => s.score > 0) // Positive score
      .slice(0, 50); // Top 50 for deduplication

    // Remove similar sentences
    const uniqueSentences = removeSimilarSentences(filteredSentences, 0.8);

    // Final selection
    const finalSentences = uniqueSentences.slice(0, 20).map((s) => s.sentence);

    console.log(`✅ MultipartiteRank completed successfully`);
    console.log(`📈 Final results: ${finalSentences.length} key sentences`);

    // Log score statistics
    const validScores = scores.filter((s) => s > 0);
    if (validScores.length > 0) {
      const avgScore =
        validScores.reduce((a, b) => a + b, 0) / validScores.length;
      const maxScore = Math.max(...validScores);
      const minScore = Math.min(...validScores);
      console.log(
        `📊 Score statistics - Avg: ${avgScore.toFixed(
          4
        )}, Max: ${maxScore.toFixed(4)}, Min: ${minScore.toFixed(4)}`
      );
    }

    return finalSentences;
  } catch (error) {
    console.error("❌ Error in MultipartiteRank extraction:", error);

    // Fallback to simple sentence extraction
    try {
      console.log("🔄 Attempting fallback extraction...");

      const sentences = splitIntoSentences(text);
      const fallbackResult = sentences
        .filter((s) => s.length >= 10)
        .slice(0, 20);

      console.log(
        `🆘 Fallback extraction completed: ${fallbackResult.length} sentences`
      );
      return fallbackResult;
    } catch (fallbackError) {
      console.error("❌ Fallback extraction also failed:", fallbackError);
      return [];
    }
  }
}
