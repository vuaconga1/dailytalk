import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/server/db";
import { deriveContent, uniqueSlug } from "../src/server/shadowing/store";
import { validateCues } from "../src/domain/shadowing/cues";
import { transcriptLines } from "../src/domain/shadowing/transcript";

interface SeedVideoItem {
  youtubeId: string;
  title: string;
  level: string;
  transcript: string;
}

const VIDEOS: SeedVideoItem[] = [
  {
    youtubeId: "DBrehOquksg",
    title: "Joey and Phoebe Are Going to Hook Up | Friends",
    level: "B1",
    transcript: `So, Ross and Rachel got married.
Monica and Chandler almost got married.
You think you and I should hook up?
Oh, we do, but not just yet.
Really?
Well, when?
Okay, well, first Chandler and Monica will get married and be filthy rich, by the way.
But it won't work out.
Wow.
I know.
Then I'm going to marry Chandler for the money.
And you'll marry Rachel and have the beautiful kids.
Great.
But then we ditch those two and that's when we get married.
We'll have Chandler's money and Rachel's kids, and getting custody will be easy because of Rachel's drinking problem.
Oh, what about Ross?
I don't want to go into the whole thing, but we have words and I kill him.`,
  },
  {
    youtubeId: "bMqF6M7kQog",
    title: "Rachel’s Dad Has Major Beef with Ross | Friends",
    level: "B2",
    transcript: `How's the library?
Uh, museum.
What happened to the library?
There never was a library.
I mean, there are libraries, it's just that I've never worked at one.
You know what's really good here?
The lobster.
What do you say, shall I just order three?
Yeah, if you're really hungry.
It was a joke, I made a joke.
Yeah, actually, Daddy, Ross is allergic to lobster.
What kind of person is allergic to lobster?
I guess the kind of person that works in a library.
It's not a library, it's a museum.
Well, you're the only one around here who could make a joke.
At least mine was funny.
Later.
Um, I have a problem, I tip way too much.
Way, way too much.
It's a sickness, really.
Yeah, it is.
It is.
We really should do something.
Excuse me, you think I'm cheap?
Oh, Daddy, no, he didn't mean anything by that.
He really didn't.
Nothing I do means anything, really.
This is nice.
I pay $200 for dinner, you put down 20 and you come out looking like Mr. Big Shot.
You really want to be Mr. Big Shot?
Oh, here, I'll tell you what.
You pay the whole bill, Mr. Big Shot, all right?
Rachel, one brunch is not going to solve anything.
You've got to face it, okay?
We're never going to get along.
Okay, well, you are just going to have to, okay?
Because I've already got a mother and a father who cannot stay in the same room together, okay?
I don't want to have to have a separate room for you, too.
Dr. Bobby happens to be an excellent doctor.
Wait a minute, his name is Dr. Bobby?
Well, that's his last name.
And his first name, he's Bobby Bobby?
It's Robert Bobby, and excuse me, he helps me.
Please, ask her how.
What do you need help for?
With my alignment.
I got one leg shorter than the other.
Oh my god.
What?
It's true, my right leg is two inches shorter.
Come on, you're just tilting.
Her legs are fine!
I know that!
So what do you let her go to a chiropractor for?
Sorry, let her?
What can I do?
She doesn't listen to me about renter's insurance either.
Wait a minute, you don't have renter's insurance?
No.
But what if somebody steals something?
How are you going to run after them with one leg shorter than the other?
Hey, would you like some juice?
I'd love some juice.
Okay.
Wow, this is going so well, did you see us?
Did you see us?
Honey, I was standing right there.
Why don't you just tell him about the mole I haven't gotten checked yet?
Excellent.`,
  },
  {
    youtubeId: "U28fPOxmYKo",
    title: "Monica’s Halloween Party: Everyone’s Grand Entrance | Friends",
    level: "B1",
    transcript: `Hi, wait, you're supposed to wear a costume.
I am.
I am a woman who spent a lot of money on a dress and she wants to wear it because soon she won't be able to fit into it.
Oh, I'm Catwoman.
Who wants to borrow the dress when you're too big for it.
Okay.
Trick or treat!
Oh, can I give out the candy?
I really want to be with the kids right now.
You know, ever since I got pregnant, I have the strongest maternal instincts.
Trick or treat.
Just a minute.
What?
Look at you guys.
Wow, you are a very scary witch.
Thank you.
And you are a very funny clown.
Thank you.
And you are so in style right now.
You know, I work at Ralph Lauren and the whole fall line has got this like equestrian theme going on.
I suppose you saw the cover of British Vogue.
Can I just have the candy?
Yeah, sure.
Ah, Catwoman, so we meet again.
So we do, Supergirl.
It's me, Phoebe.
Monica, can I talk to you for a second?
Listen, I appreciate you getting me the costume.
Oh, you did this to me?
What?
I thought he'd love it.
His favorite kids book was The Velveteen Rabbit.
The Velveteen Rabbit was brown and white.
Well, it was either a pink bunny or no bunny at all.
No bunny at all, always no bunny at all.
Hey, you didn't dress up either.
Yes, I did, I'm Chandler.
Dude, what happened?
How is that me?
Okay.
I'm Chandler.
Oh, that is so you.
When have I ever done that?
When have I ever done that?
Trick or treat.
Aw, well, you're just the prettiest ballerina I've ever seen.
Thank you.
Oh, wow, that deserves another piece of candy.
Thank you.
Well, I have to say that earns two pieces of candy.
I love you.
Aw, oh, honey, here, take it all.
Monica, we need more candy.
What?
There's only been like four kids.
Yeah, I know, but one of them just said that she loved me, so I just gave her everything.
No wonder you're pregnant.
Hey.
Hey, what are you supposed to be?
Remember the Russian satellite, Sputnik?
Well, I'm a potato or a spud, and these are my antenna.
So, Sputnik becomes Spudnik.
Spudnik.
Wow, I don't have the worst costume anymore.
Hey, all right, Ross came as duty.
No, I'm not duty.
No, space duty.
Yeah.`,
  },
  {
    youtubeId: "QppTsxPQMFw",
    title: "Chandler’s Crazy Roommate Watches Him While He Sleeps | Friends",
    level: "B1",
    transcript: `Hey, Eddie.
What are you doing here?
Nothing really, just watching you sleep.
Why?
Makes me feel peaceful.
Please, I can't sleep now.
Oh, you want me to sing?
Look, that's it, it's over, I want you out.
I want you out of the apartment now.
Oh, well, what are you talking, Hannibal Lecter?
Hannibal Lecter?
Better roommate than you.
No, see, now I don't think you're being fair.
I mean, one night you see me and you get scared.
I mean, well, what about all the other nights when you don't see me, huh?
What about last night when you went and got a drink of water and I was nice enough to hide behind the door?
What's that about, huh?
I didn't realize that.
Get out now.
Okay, you really want me out?
Yes, please.
Okay, then I want to hear you say it out loud.
I want to hear you say you want me out.
I want you out.
No, no, no, I want to hear it from your lips.
Where did you hear it from before?
All right, all right.
You know what, pal?
Yeah, I understand, consider me gone.
You know what, I'll be out by the time you get home tomorrow.
I heard that.
Hey, pal.
Eddie, what are you still doing here?
Ah, just some basic dehydrating of a few fruits and vegetables.
Man alive, this thing's fantastic!
Look, Eddie, aren't you forgetting anything?
Oh, yeah, that's right.
Look, I got us a new goldfish.
He's a lot feistier than the last one.
Yeah, maybe cuz the last one was made by Pepperidge Farm.
Eddie, isn't there something else you're supposed to be doing right now?
Well, not unless it's got something to do with dehydrating, my man, cuz right now I'm a dehydrating maniac.
Look, you have to help me out here.
I thought we had a deal.
I thought by the time I got...
You know what that is?
Your last roommate's kidney?
No, that's a tomato.
This one definitely goes in the display.
Why must everybody watch me sleep?
There'll be no more watching me sleep!
No more watching!`,
  },
  {
    youtubeId: "nG17Ww8eVJE",
    title: "Rachel Faces Her Greatest Fear: The Swings | Friends",
    level: "B1",
    transcript: `Okay, look, Ross, I do not want Emma going to the playground.
Because—
All right, well, if you must know, I had a traumatic swing incident when I was little.
Seriously?
Yes, I was 4 years old and I was on the swing and then all of a sudden my hair got tangled in the chain.
And to get me out, my mom had to cut a big chunk of my hair.
And it was uneven for weeks.
And you made it through that?
I wonder who's going to play you in the movie.
Okay, hello.
All right, okay, be careful, be careful.
Watch her hair, watch her hair.
Right, she's got like three hairs.
I know, but they're just so beautiful.
Oh my god, I just pulled one out.
I promise you she's safe.
Okay, now watch, watch how much she loves this.
Are you ready, sweetie?
Here we go.
Okay, careful.
She's smiling, oh, look at that, she does like it!
See, I told you.
Oh my god, look at her, she's a little daredevil!
Oh, let me push, can I push?
Oh, absolutely.
Okay, get the camera, it's in the diaper bag.
See, scared of the swings, I bet you feel pretty silly.
Oh god, Ross!
Oh my god, are you okay?
Son of a—
Oh, relax, I didn't say the F word.
Ross, see, I told you those swings are evil!
All right, that is it, that is the last time Emma is getting on one of those things for her entire life!
No, it wasn't the swings' fault.
It was my fault and kind of that kid's fault who is still laughing.
Nice.
Ross, come on, please, can we just get out of here before somebody else gets hurt?
No, wait.
Okay, I have an idea.
I want you to get on the swing, okay?
And you'll see that there's nothing to be afraid of.
I know what this is all about, you've always been jealous of my hair.
Look, I just think you're an adult, okay?
And you should get over your silly fears.
All right, fine, I'll do it.
Good.
If you hold a spider.
What?
Where?
Where?
If you hold a spider.
I know.
Okay, I got a spider.
There were two, I picked the bigger one.
Okay, this feels perfectly normal.
Okay, get on the swing.
All right, I can do this.
There you go, good for you.
And you know what?
I'm actually getting used to this little guy.
I don't really even feel him in here anymore.
That's cuz he's on your neck.
What?`,
  },
  {
    youtubeId: "hUuC9GoaELI",
    title: "Hoạt Hình Tiếng Anh | Công Chúa Tóc Mây Rapunzel (TANGLED) | Song Ngữ Anh - Việt",
    level: "A2",
    transcript: `Okay.
Is this hair?
Struggling, struggling is pointless.
I know why you're here, and I'm not afraid of you.
What?
Who are you, and how did you find me?
Aha, who are you, and how did you find me?
I know not who you are, nor how I came to find you, but may I just say...
Hi, how you doing?
The name's Flynn Rider.
How's your day going?
Who else knows my location, Flynn Rider?
All right, Blondie.
Rapunzel.
Here's the deal.
I was in a situation, gallivanting through the forest, I came across your tower, and...
Oh no, where is my satchel?
I've hidden it somewhere you'll never find it.
It's in that pot, isn't it?
Would you stop that!
Now it's hidden where you'll never find it.
So, what do you want with my hair?
To cut it?
What?
Sell it?
No, listen!
The only thing I want to do with your hair is to get out of it, literally!
Wait, you don't want my hair?
Why on Earth would I want your hair?
Look, I was being chased, I saw a tower, I climbed it, end of story.
You're telling the truth?
Yes.
I think he's telling the truth, too.
Doesn't have fangs.
But what choice do I have?
Okay, Flynn Rider, I'm prepared to offer you a deal.
Deal?
Look this way.
Do you know what these are?
You mean the lantern thing they do for the princess?
Lanterns!
I knew they weren't stars!
Well, tomorrow evening they will light the night sky with these lanterns.
You will act as my guide, take me to these lanterns, and return me home safely.
Then, and only then, will I return your satchel to you.
That is my deal.
Yeah, no can do.
Unfortunately, the kingdom and I aren't exactly sympatico at the moment, so I won't be taking you anywhere.
Something brought you here, Flynn Rider.
Call it what you will: fate, destiny, a horse.
So I have made the decision to trust you.
A horrible decision, really.
But trust me when I tell you this:
You can tear this tower apart brick by brick, but without my help, you will never find your precious satchel.
Let me just get this straight:
I take you to see the lanterns, bring you back home, and you'll give me back my satchel?
I promise.
And when I promise something, I never ever break that promise.
Ever.
All right, listen, I didn't want to have to do this, but you leave me no choice.
Here comes the smolder.
This is kind of an off day for me, this doesn't normally happen.
Fine, I'll take you to see the lanterns.
Really?`,
  },
];

async function main() {
  console.log("=== PREPARING SHADOWING EXERCISES ===");
  const dumpDir = path.join(process.cwd(), "scripts", "dump");
  const processedItems: any[] = [];

  let order = 1;
  for (const item of VIDEOS) {
    const dumpPath = path.join(dumpDir, `${item.youtubeId}.json`);
    const dumpData = JSON.parse(await fs.readFile(dumpPath, "utf8"));
    const { words, durationSec, source } = dumpData;

    // 1. Derive content (cues + IPA annotations)
    const derived = deriveContent(item.transcript, words, item.youtubeId);
    const cues = derived.cues as any;
    if (!cues) {
      throw new Error(`Failed to build cues for ${item.youtubeId}`);
    }

    // 2. Validate cues
    const validated = validateCues(cues, item.transcript, item.youtubeId);
    if (!validated) {
      throw new Error(`Cues validation failed for ${item.youtubeId}`);
    }

    // 3. Verify no line has start >= end
    for (let i = 0; i < cues.lines.length; i++) {
      const line = cues.lines[i];
      if (line.start >= line.end) {
        throw new Error(`Line ${i} has start (${line.start}) >= end (${line.end}): "${line.text}"`);
      }
    }

    const linesCount = transcriptLines(item.transcript).length;
    const maxRecordSeconds = Math.min(300, Math.max(5, Math.round((durationSec ?? 20) * 1.3 + 10)));

    const record = {
      title: item.title,
      level: item.level,
      youtubeId: item.youtubeId,
      durationSec,
      transcript: item.transcript,
      captionWords: words,
      captionSource: source,
      maxRecordSeconds,
      order: order++,
      status: "DRAFT",
      cues: derived.cues,
      annotations: derived.annotations,
      linesCount,
    };

    processedItems.push(record);
    console.log(`[OK] ${item.youtubeId} | ${item.title} | ${linesCount} lines | Level: ${item.level} | Dur: ${durationSec}s | MaxRec: ${maxRecordSeconds}s`);
  }

  // Save bundle JSON for offline persistence & backup
  const bundlePath = path.join(process.cwd(), "scripts", "shadowing-seed-bundle.json");
  await fs.writeFile(bundlePath, JSON.stringify(processedItems, null, 2), "utf8");
  console.log(`\nSuccessfully saved complete seed bundle to: ${bundlePath}`);

  // Try database insert if database is configured
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl.includes("ep-xxx") || !dbUrl) {
    console.log("\n[INFO] DATABASE_URL is currently pointing to placeholder/ep-xxx. DB write skipped.");
    console.log("[INFO] When DATABASE_URL is updated in .env, run this script to insert into DB:");
    console.log("       npx tsx --conditions=react-server scripts/seed-shadowing-videos.ts");
    return;
  }

  console.log("\nAttempting DB insertion...");
  for (const item of processedItems) {
    const slug = await uniqueSlug(item.title);
    const existing = await prisma.shadowingExercise.findFirst({ where: { youtubeId: item.youtubeId } });
    if (existing) {
      await prisma.shadowingExercise.update({
        where: { id: existing.id },
        data: {
          title: item.title,
          level: item.level,
          transcript: item.transcript,
          cues: item.cues,
          annotations: item.annotations,
          status: "DRAFT",
          maxRecordSeconds: item.maxRecordSeconds,
        },
      });
      console.log(`Updated in DB: ${item.youtubeId} -> ${existing.slug}`);
    } else {
      const created = await prisma.shadowingExercise.create({
        data: {
          slug,
          title: item.title,
          level: item.level,
          youtubeId: item.youtubeId,
          durationSec: item.durationSec,
          transcript: item.transcript,
          captionWords: item.captionWords,
          captionSource: item.captionSource,
          maxRecordSeconds: item.maxRecordSeconds,
          order: item.order,
          status: "DRAFT",
          cues: item.cues,
          annotations: item.annotations,
        },
      });
      console.log(`Created in DB: ${item.youtubeId} -> ${created.slug}`);
    }
  }
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

