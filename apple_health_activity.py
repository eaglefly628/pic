"""Stream an Apple Health export into a small, source-scoped activity archive.

The original ZIP stays with the user. Heart-rate and step samples are reduced to
chart buckets; their fingerprints are retained solely for idempotent imports.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
import hashlib
import io
import json
import math
import os
from pathlib import Path
import tempfile
from xml.parsers import expat
import zipfile

MAX_ZIP = 100 * 1024 * 1024
BAD_XML_BYTES = bytes([*range(9), 11, 12, *range(14, 32)])
WATCH = 'Apple Watch'
HR = 'HKQuantityTypeIdentifierHeartRate'
STEPS = 'HKQuantityTypeIdentifierStepCount'
SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis'
LOW_FREQUENCY = {
    'HKQuantityTypeIdentifierBodyMass',
    'HKQuantityTypeIdentifierBodyFatPercentage',
    'HKQuantityTypeIdentifierBodyMassIndex',
    'HKQuantityTypeIdentifierBloodPressureSystolic',
    'HKQuantityTypeIdentifierBloodPressureDiastolic',
}


def _stamp(value):
    return datetime.strptime(value, '%Y-%m-%d %H:%M:%S %z')


def _id(attributes):
    fields = [attributes.get(key, '') for key in
              ('sourceName', 'device', 'type', 'startDate', 'endDate', 'value', 'unit')]
    return hashlib.sha256(json.dumps(fields, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


def _empty():
    return {'schema': 1, 'watch_source': '', 'last_import_at': '', 'data_cutoff_date': '',
            'export_sha256': '', 'heart_rate_hourly': {}, 'steps_daily': {},
            'heart_rate_ids': [], 'step_ids': [], 'sleep_segments': [],
            'metrics': [], 'workouts': [], 'unassigned_measurements': [],
            'import_issues': []}


def read(root):
    path = Path(root) / 'apple-health-activity.json'
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else _empty()


def public(root):
    data = read(root)
    # The page/cloud needs chart points, not de-duplication IDs or family measurements.
    series = defaultdict(list)
    categories = defaultdict(lambda: defaultdict(Counter))
    for row in data['metrics']:
        try:
            value = float(row['value'])
            if math.isfinite(value): series[row['type']].append((row['start'], value, row['unit']))
        except (ValueError, TypeError):
            categories[row['type']][row['start'][:10]][row['value']] += 1
    metric_series = []
    for kind, rows in sorted(series.items()):
        if len(rows) <= 500:
            points = [{'date': stamp[:10], 'time': stamp, 'value': value}
                      for stamp, value, _ in rows]
            granularity = 'sample'
        else:
            daily = defaultdict(list)
            for stamp, value, _ in rows: daily[stamp[:10]].append(value)
            additive = any(word in kind for word in ('EnergyBurned', 'Distance', 'ExerciseTime', 'StandTime'))
            points = [{'date': day, 'value': round(sum(values) if additive else sum(values) / len(values), 3),
                       'count': len(values)} for day, values in sorted(daily.items())]
            granularity = 'day'
        metric_series.append({'type': kind, 'unit': rows[0][2], 'samples': len(rows),
                              'granularity': granularity, 'points': points})
    for kind, days in sorted(categories.items()):
        points = [{'date': day, 'value': counts.get('HKCategoryValueAppleStandHourStood', sum(counts.values())),
                   'categories': dict(counts)} for day, counts in sorted(days.items())]
        metric_series.append({'type': kind, 'unit': '次/日',
                              'samples': sum(sum(c.values()) for c in days.values()),
                              'granularity': 'day', 'points': points})
    return {key: value for key, value in data.items() if key not in
            {'heart_rate_ids', 'step_ids', 'sleep_segments', 'unassigned_measurements', 'metrics', 'export_sha256', 'watch_source'}} | {
        'watch_source': 'Apple Watch' if data['watch_source'] else '',
        'unassigned_count': len(data['unassigned_measurements']),
        'sleep_nights': _sleep_nights(data['sleep_segments']),
        'metric_series': metric_series,
        'heart_rate_hourly': [{**value, 'hour': hour,
                               'average': round(value['sum'] / value['count'], 1)}
                              for hour, value in sorted(data['heart_rate_hourly'].items())],
        'steps_daily': [{'date': day, 'count': round(value, 2)}
                        for day, value in sorted(data['steps_daily'].items())],
        'ok': True,
    }


def _sleep_nights(segments):
    nights = defaultdict(list)
    for row in segments:
        start = _stamp(row['start'])
        night = (start - timedelta(days=start.hour < 12)).date().isoformat()
        nights[night].append(row)
    result = []
    for night, rows in sorted(nights.items()):
        stages = Counter()
        for row in rows:
            stage = row['stage'].replace('HKCategoryValueSleepAnalysis', '')
            minutes = max(0, (_stamp(row['end']) - _stamp(row['start'])).total_seconds() / 60)
            stages[stage] += minutes
        asleep = sum(value for key, value in stages.items() if key.startswith('Asleep'))
        result.append({'date': night, 'asleep_minutes': round(asleep),
                       'stages': {key: round(value) for key, value in stages.items()},
                       'segments': len(rows)})
    return result


def _write(root, data):
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    target = root / 'apple-health-activity.json'
    fd, name = tempfile.mkstemp(prefix='.apple-health-', dir=root)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'w', encoding='utf-8') as out:
            json.dump(data, out, ensure_ascii=False, separators=(',', ':'))
            out.flush(); os.fsync(out.fileno())
        os.replace(name, target)
    finally:
        if os.path.exists(name): os.unlink(name)


def import_zip(raw, root):
    if not 0 < len(raw) <= MAX_ZIP:
        raise ValueError('Apple 健康 ZIP 超过 100 MB')
    old = read(root)
    data = {**_empty(), **old}
    data['heart_rate_hourly'] = dict(old['heart_rate_hourly'])
    data['steps_daily'] = dict(old['steps_daily'])
    seen_hr, seen_steps = set(old['heart_rate_ids']), set(old['step_ids'])
    sleep = {row['id']: row for row in old['sleep_segments']}
    metrics = {row['id']: row for row in old['metrics']}
    workouts = {row['id']: row for row in old['workouts']}
    unassigned = {row['id']: row for row in old['unassigned_measurements']}
    watch_sources = Counter()
    added = Counter()
    newest = old.get('data_cutoff_date', '')
    invalid_bytes = 0
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or len(names) > 1000:
            raise ValueError('ZIP 存在重复路径或条目过多')
        xml = [item for item in archive.infolist() if item.filename.endswith('.xml')
               and 'cda' not in item.filename.lower()]
        if len(xml) != 1 or xml[0].file_size > 3 * 1024**3:
            raise ValueError('未找到唯一的 Apple 健康主 XML，或解压体积过大')

        def start(tag, a):
            nonlocal newest
            if tag not in ('Record', 'Workout'):
                return
            source = a.get('sourceName', '').replace('\xa0', ' ')
            is_watch = WATCH.lower() in source.lower()
            if tag == 'Record' and a.get('type') in LOW_FREQUENCY and not is_watch:
                ident = _id(a)
                if ident not in unassigned:
                    unassigned[ident] = {'id': ident, 'type': a['type'], 'source': source,
                                         'start': a.get('startDate', ''), 'end': a.get('endDate', ''),
                                         'value': a.get('value', ''), 'unit': a.get('unit', '')}
                    added['unassigned'] += 1
            if not is_watch:
                return
            watch_sources[source] += 1
            if data['watch_source'] and source != data['watch_source']:
                return
            date = a.get('startDate', '')[:10]
            if date > newest: newest = date
            ident = _id(a)
            if tag == 'Workout':
                if ident not in workouts:
                    workouts[ident] = {'id': ident, 'type': a.get('workoutActivityType', ''),
                                        'start': a.get('startDate', ''), 'end': a.get('endDate', ''),
                                        'duration': a.get('duration', ''), 'duration_unit': a.get('durationUnit', '')}
                    added['workouts'] += 1
                return
            kind = a.get('type', '')
            if kind == HR or kind == STEPS:
                seen = seen_hr if kind == HR else seen_steps
                if ident in seen: return
                try:
                    value = float(a['value'])
                    if not math.isfinite(value): return
                    timestamp = _stamp(a['startDate'])
                except (ValueError, KeyError): return
                seen.add(ident)
                if kind == HR:
                    hour = timestamp.strftime('%Y-%m-%dT%H:00%z')
                    bucket = data['heart_rate_hourly'].setdefault(hour, {'sum': 0, 'count': 0, 'min': value, 'max': value})
                    bucket['sum'] += value; bucket['count'] += 1
                    bucket['min'] = min(bucket['min'], value); bucket['max'] = max(bucket['max'], value)
                    added['heart_rate'] += 1
                else:
                    day = timestamp.date().isoformat()
                    data['steps_daily'][day] = data['steps_daily'].get(day, 0) + value
                    added['steps'] += 1
            elif kind == SLEEP:
                if ident not in sleep:
                    sleep[ident] = {'id': ident, 'start': a.get('startDate', ''),
                                    'end': a.get('endDate', ''), 'stage': a.get('value', '')}
                    added['sleep'] += 1
            elif ident not in metrics:
                metrics[ident] = {'id': ident, 'type': kind, 'start': a.get('startDate', ''),
                                  'end': a.get('endDate', ''), 'value': a.get('value', ''),
                                  'unit': a.get('unit', '')}
                added['metrics'] += 1

        parser = expat.ParserCreate()
        parser.StartElementHandler = start
        parser.SetParamEntityParsing(expat.XML_PARAM_ENTITY_PARSING_NEVER)
        parser.ExternalEntityRefHandler = lambda *_: 0
        with archive.open(xml[0]) as stream:
            while chunk := stream.read(1024 * 1024):
                cleaned = chunk.translate(None, BAD_XML_BYTES)
                invalid_bytes += len(chunk) - len(cleaned)
                parser.Parse(cleaned, False)
            parser.Parse(b'', True)
    if not watch_sources:
        raise ValueError('未找到 Apple Watch 来源记录')
    if not data['watch_source']:
        if len(watch_sources) != 1:
            raise ValueError('发现多只 Apple Watch，请先选择本人设备')
        data['watch_source'] = next(iter(watch_sources))
    if data['watch_source'] not in watch_sources:
        raise ValueError('新 ZIP 缺少原 Apple Watch 来源，未更新')
    data.update(heart_rate_ids=sorted(seen_hr), step_ids=sorted(seen_steps),
                sleep_segments=sorted(sleep.values(), key=lambda r: r['start']),
                metrics=sorted(metrics.values(), key=lambda r: (r['type'], r['start'])),
                workouts=sorted(workouts.values(), key=lambda r: r['start']),
                unassigned_measurements=sorted(unassigned.values(), key=lambda r: r['start']),
                data_cutoff_date=newest, export_sha256=hashlib.sha256(raw).hexdigest(),
                last_import_at=datetime.now(timezone.utc).isoformat(),
                import_issues=([f'已跳过 {invalid_bytes} 个非法 XML 控制字节'] if invalid_bytes else []))
    _write(root, data)
    return {'ok': True, 'added': dict(added), 'cutoff': newest,
            'sleep_nights': len(_sleep_nights(data['sleep_segments'])),
            'unassigned_count': len(data['unassigned_measurements']),
            'watch_metric_types': len({row['type'] for row in data['metrics']}) + 3,
            'invalid_xml_bytes': invalid_bytes}
