# -*- coding: utf-8 -*-
"""lens API 图生视频 CLI：提交 → 轮询 → 下载。

key 安全：只从环境变量 LENSAPI_KEY 或仓库外文件读取
（默认 C:/Users/user/.kw_secrets/lensapi_key.txt），绝不写入本仓库。

用法：
  提交新任务并等结果：
    python art_video_gen.py --image https://kw-vfx-src.pages.dev/xx.png --prompt-file prompt.txt \
        --seconds 1 --ratio 1:1 --out out.mp4
  断点续查（连接断了/换会话）：
    python art_video_gen.py --resume task_xxxx --out out.mp4

返回码：0 成功；1 失败（任务 failed 或超时）。
接口约定（2026-10 探测）：
  POST /v1/videos  {model, prompt, seconds, aspect_ratio(别名ratio), images:[公网URL]}
  GET  /v1/videos/{id} → status queued/in_progress/completed/failed, progress
  completed 后 download_url 为签名直链（无需 key）。
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request

API = 'https://lensapi.cn'
KEY_FILE = 'C:/Users/user/.kw_secrets/lensapi_key.txt'


def key():
    k = os.environ.get('LENSAPI_KEY')
    if k:
        return k.strip()
    with open(KEY_FILE, encoding='utf-8') as f:
        return f.read().strip()


def req(method, path, payload=None, raw=False, timeout=60):
    r = urllib.request.Request(API + path, method=method,
                               headers={'Authorization': 'Bearer ' + key(),
                                        'Content-Type': 'application/json'})
    data = None
    if payload is not None:
        data = json.dumps(payload).encode('utf-8')
    try:
        with urllib.request.urlopen(r, data=data, timeout=timeout) as resp:
            b = resp.read()
    except urllib.error.HTTPError as e:
        b = e.read()
    if raw:
        return b
    return json.loads(b.decode('utf-8'))


def submit(args):
    payload = {'model': args.model, 'seconds': args.seconds, 'aspect_ratio': args.ratio}
    if args.resolution:
        payload['resolution'] = args.resolution
    if args.prompt_file:
        payload['prompt'] = open(args.prompt_file, encoding='utf-8').read().strip()
    elif args.prompt:
        payload['prompt'] = args.prompt
    else:
        sys.exit('--prompt 或 --prompt-file 必填')
    if args.image:
        # 公网 API 不收本地文件/DataURL：首帧需先部署到 美术/vfx_host 再传 URL
        if args.image.startswith('http'):
            payload['images'] = [args.image]
        else:
            sys.exit('本地图片需先部署到 美术/vfx_host（wrangler pages deploy）后传 URL')
    d = req('POST', '/v1/videos', payload, timeout=90)
    if 'error' in d or not d.get('id'):
        print('submit error:', json.dumps(d, ensure_ascii=False))
        return None
    print('task:', d['id'], d['status'])
    return d['id']


def poll(task, out, max_min):
    t0 = time.time()
    while (time.time() - t0) < max_min * 60:
        d = req('GET', '/v1/videos/' + task)
        st = d.get('status'), d.get('progress')
        print('[%s] %s' % (time.strftime('%H:%M:%S'), st), flush=True)
        if st[0] == 'completed':
            url = d.get('download_url')
            if not url:
                print('no download_url:', json.dumps(d, ensure_ascii=False)[:500])
                return 1
            if url.startswith(API):
                raw = req('GET', url[len(API):], raw=True, timeout=180)
            else:
                raw = urllib.request.urlopen(url, timeout=180).read()
            with open(out, 'wb') as f:
                f.write(raw)
            print('saved %s (%d bytes)' % (out, len(raw)))
            return 0
        if st[0] == 'failed':
            print('FAILED:', json.dumps(d, ensure_ascii=False)[:800])
            return 1
        time.sleep(15)
    print('timeout after %d min; 用 --resume %s 续查' % (max_min, task))
    return 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--image', help='首帧图（公网 URL；本地文件先部署 vfx_host）')
    ap.add_argument('--prompt', help='提示词文本')
    ap.add_argument('--prompt-file', help='提示词文件（UTF-8）')
    ap.add_argument('--model', default='lens-minimax-h3-768p')
    ap.add_argument('--seconds', type=int, default=1)
    ap.add_argument('--ratio', default='1:1')
    ap.add_argument('--resolution', help='可选输出分辨率，例如 768p；按模型支持值填写')
    ap.add_argument('--out', default='vfx_clip.mp4')
    ap.add_argument('--resume', help='续查已有 task id')
    ap.add_argument('--max-min', type=int, default=12, help='轮询超时(分钟)')
    args = ap.parse_args()

    task = args.resume or submit(args)
    if not task:
        return 1
    return poll(task, args.out, args.max_min)


if __name__ == '__main__':
    sys.exit(main())
