"""Production framing contract for complete-character source frames."""
import numpy as np

SOURCE_MARGIN_PIXELS = 12


def source_frame_margin(image):
    alpha = np.asarray(image.getchannel('A'))
    ys, xs = np.where(alpha > 32)
    if not len(xs):
        raise ValueError('A complete-character source frame must contain a visible hero')
    box = [int(xs.min()), int(ys.min()), int(xs.max()+1), int(ys.max()+1)]
    margins = [box[0], box[1], image.width-box[2], image.height-box[3]]
    return {'bounds': box, 'margins': margins, 'minimumMargin': min(margins),
            'requiredMargin': SOURCE_MARGIN_PIXELS, 'completeWithinSource': min(margins) >= SOURCE_MARGIN_PIXELS}


def require_source_margin(images, indices):
    records = [{'sourceFrame': index, **source_frame_margin(image)} for index, image in zip(indices, images)]
    clipped = [record['sourceFrame'] for record in records if not record['completeWithinSource']]
    if clipped:
        raise ValueError('Source frames touch or approach the video boundary: ' + str(clipped)
                         + '. Reject this source and regenerate a complete video with more framing margin; do not shorten the motion to hide missing cloth.')
    return records
