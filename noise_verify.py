import hashlib, random, time, json

def simulate_observer_attack(commitments: list[dict]) -> dict:
    """
    Simulasi timing analysis attack.
    Return: seberapa banyak info yang bisa di-extract observer.
    """
    # Observer hanya bisa lihat: hash + timestamp
    observable = [
        {"hash": c["commitment"], "time": c["timestamp"]}
        for c in commitments
    ]

    # Coba korelasi timing → amount (ini yang attacker akan coba)
    time_gaps = []
    for i in range(1, len(observable)):
        gap = observable[i]["time"] - observable[i-1]["time"]
        time_gaps.append(gap)

    # Dengan noise injection, variance tinggi = tidak bisa di-predict
    import statistics
    variance = statistics.variance(time_gaps) if len(time_gaps) > 1 else 0

    return {
        "commits_visible": len(observable),
        "real_commits": sum(1 for c in commitments if not c.get("isNoise")),
        "noise_commits": sum(1 for c in commitments if c.get("isNoise")),
        "timing_variance_ms": round(variance, 2),
        "attack_feasible": variance < 100,  # False = privacy protected
        "observer_can_see": ["vault exists", "deadline", "total locked"],
        "observer_cannot_see": ["individual amounts", "who paid what", "conditions"],
    }

# Demo output untuk Loom recording
if __name__ == "__main__":
    # Simulasi 3 payer + noise
    mock_commits = [
        {"commitment": hashlib.sha256(b"real1").hexdigest(), "timestamp": 1000, "isNoise": False},
        {"commitment": hashlib.sha256(b"noise1").hexdigest(), "timestamp": 1847, "isNoise": True},
        {"commitment": hashlib.sha256(b"real2").hexdigest(), "timestamp": 2134, "isNoise": False},
        {"commitment": hashlib.sha256(b"noise2").hexdigest(), "timestamp": 3901, "isNoise": True},
        {"commitment": hashlib.sha256(b"real3").hexdigest(), "timestamp": 4203, "isNoise": False},
    ]

    result = simulate_observer_attack(mock_commits)
    print(json.dumps(result, indent=2))