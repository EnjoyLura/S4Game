"""Retain UI chrome, small images, portraits and VFX in the offline budget model."""
from pathlib import Path
import argparse
import json
import re

PROJECT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('measurement', type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).with_name('mixed-quality-budget-current.json'))
    args = parser.parse_args()
    report = json.loads(args.measurement.read_text('utf-8'))
    slices = set(re.findall(r"^\s*'([^']+)': \{ canon", (PROJECT / 'assets/scripts/ui/Ux.ts').read_text('utf-8'), re.M))
    rows = []
    for item in report['images']:
        source = item['source']
        name = Path(source).stem
        key = source.removeprefix('assets/resources/ux/').removesuffix('.png')
        reasons = []
        if 'comic' in source:
            reasons.append('retain existing comic UI/equipment pixels')
        if source.startswith('assets/resources/fx/'):
            reasons.append('retain existing VFX pixels')
        if key in slices:
            reasons.append('retain nine-slice UI pixels')
        if max(item['width'], item['height']) <= 512:
            reasons.append('retain small image pixels')
        if re.match(r'(ui_panel|ui_button|ui_currency|ui_icon|icon_|glyph_|btn_|hero_)', name):
            reasons.append('retain UI chrome/portraits pixels')
        rows.append(dict(item, proposedBytes=item['bytes'] if reasons else item['selectedBytes'], keepLosslessReasons=reasons))
    total = report['otherBytesKept'] + sum(item['proposedBytes'] for item in rows)
    result = {'baselineRelease': report['baselineRelease'], 'currentFullPackageBytes': report['currentFullPackageBytes'],
              'mixedQualityCandidateBytesBeforeMetadataReversioning': total, 'budgetBytes': 200000000,
              'headroomBytesBeforeMetadataReversioning': 200000000 - total,
              'imagesRetainingCurrentBytes': sum(item['proposedBytes'] == item['bytes'] for item in rows),
              'imagesUsingQ95Candidate': sum(item['proposedBytes'] < item['bytes'] for item in rows),
              'groups': {group: {'currentBytes': sum(item['bytes'] for item in rows if item['group'] == group),
                                  'candidateBytes': sum(item['proposedBytes'] for item in rows if item['group'] == group)} for group in sorted(set(item['group'] for item in rows))},
              'productionChanged': False, 'notAnExportedGamePackage': True, 'requiresVisualReview': True, 'images': rows}
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), 'utf-8')
    print(json.dumps({key: value for key, value in result.items() if key != 'images'}, indent=2))


if __name__ == '__main__':
    main()
