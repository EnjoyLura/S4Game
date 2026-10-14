"""Forward-only timing for source-native full-character idle cycles, never attacks."""

CONTRACT = 'hero-idle-forward-native-loop-v3'


def idle_loop_timeline(count, seconds):
    if count < 2 or seconds <= 0:
        raise ValueError('An idle loop needs at least two frames and a positive duration')
    # Cloth inertia cannot be repaired by reversing source time. The video itself
    # must complete a natural cycle; this function only assigns forward timing.
    order = list(range(count))
    durations = [seconds / count] * count
    durations[-1] += seconds - sum(durations)
    contract = {
        'id': CONTRACT,
        'strategy': 'All source frames in chronological order; the source video must naturally complete its own cycle',
        'reversePlayback': False,
        'pingPong': False,
        'nativeSourceCycleRequired': True,
        'noArtificialHold': True,
        'uniformFrameTiming': True,
        'wrapFrames': [order[-1], order[0]],
        'noOpacityCrossfade': True,
        'acceptance': 'Forward timing does not certify source closure or visual quality; final effect review by user',
    }
    return order, durations, contract
