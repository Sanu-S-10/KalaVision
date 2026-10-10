import numpy as np

def create_geometric_features(X):
    """
    X shape: (samples, 63)
    21 landmarks × (x, y, z)
    """

    landmarks = X.reshape(-1, 21, 3)

    features = []

    for hand in landmarks:

        sample = []

        # -------------------------------------------------
        # 1. Pairwise distances between important landmarks
        # -------------------------------------------------

        pairs = [
            (0, 4),   # wrist -> thumb tip
            (0, 8),   # wrist -> index tip
            (0, 12),  # wrist -> middle tip
            (0, 16),  # wrist -> ring tip
            (0, 20),  # wrist -> pinky tip

            (4, 8),   # thumb -> index
            (4, 12),  # thumb -> middle
            (4, 16),  # thumb -> ring
            (4, 20),  # thumb -> pinky

            (8, 12),  # index -> middle
            (8, 16),  # index -> ring
            (8, 20),  # index -> pinky

            (12, 16), # middle -> ring
            (12, 20), # middle -> pinky

            (16, 20)  # ring -> pinky
        ]

        for a, b in pairs:
            distance = np.linalg.norm(hand[a] - hand[b])
            sample.append(distance)

        # -------------------------------------------------
        # 2. Finger lengths
        # -------------------------------------------------

        fingers = [
            (1, 2, 3, 4),      # thumb
            (5, 6, 7, 8),      # index
            (9, 10, 11, 12),   # middle
            (13, 14, 15, 16),  # ring
            (17, 18, 19, 20)   # pinky
        ]

        for finger in fingers:

            length = 0

            for i in range(len(finger) - 1):
                length += np.linalg.norm(
                    hand[finger[i]] - hand[finger[i + 1]]
                )

            sample.append(length)

        # -------------------------------------------------
        # 3. Joint angles
        # -------------------------------------------------

        angle_triplets = [
            (1, 2, 3),
            (2, 3, 4),

            (5, 6, 7),
            (6, 7, 8),

            (9, 10, 11),
            (10, 11, 12),

            (13, 14, 15),
            (14, 15, 16),

            (17, 18, 19),
            (18, 19, 20)
        ]

        for a, b, c in angle_triplets:

            v1 = hand[a] - hand[b]
            v2 = hand[c] - hand[b]

            denominator = (
                np.linalg.norm(v1) *
                np.linalg.norm(v2)
            )

            if denominator == 0:
                angle = 0
            else:
                cosine = np.dot(v1, v2) / denominator
                cosine = np.clip(cosine, -1.0, 1.0)
                angle = np.arccos(cosine)

            sample.append(angle)

        features.append(sample)

    return np.array(features, dtype=np.float32)
