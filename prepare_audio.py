"""Optional: pre-generate reusable shadowing audio. This incurs provider charges."""
import argparse,json
import server
from content import LESSONS

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--lesson',choices=list(LESSONS),help='Omit to prepare the whole bank')
    p.add_argument('--confirm-costs',action='store_true',help='Explicitly enable paid API calls')
    args=p.parse_args()
    if server.AI_CLIENT.mode!='openai':p.error('Set AI_MODE=openai and model variables first.')
    catalog=[LESSONS[args.lesson]] if args.lesson else list(LESSONS.values())
    items=[]
    for l in catalog:
        for text in [' '.join(l['dialogue']),*l['dialogue']]:
            key=server.tokenhash(json.dumps([server.AI_CLIENT.tts,server.AI_CLIENT.voice,text]))
            target=server.DATA/'audio'/(key+'.mp3')
            if not target.exists():items.append((target,text))
    print(f'Audio missing: {len(items)}. Text characters: {sum(len(t) for _,t in items)}.')
    if not args.confirm_costs:print('Dry run. Add --confirm-costs to call provider.');raise SystemExit(0)
    for target,text in items:
        data=server.AI_CLIENT.speech(text);tmp=target.with_suffix('.tmp');tmp.write_bytes(data);tmp.replace(target)
    print('Prepared shared shadowing audio. No learner-specific data was used.')
