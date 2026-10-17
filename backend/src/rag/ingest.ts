import dotenv from 'dotenv';
dotenv.config();

import { ChromaClient } from 'chromadb';
import { generateEmbedding } from '../adapters/ModelAdapter';

interface VetDocument {
  id: string;
  text: string;
  sourceTitle: string;
  sourceUrl: string;
  category: 'nutrition' | 'emergency' | 'dermatology' | 'preventive' | 'toxicology' | 'digestive';
  pageNumber?: number;
}

const VET_KNOWLEDGE_DOCUMENTS: VetDocument[] = [
  {
    id: 'vet-tox-001',
    category: 'toxicology',
    sourceTitle: 'Merck Veterinary Manual - Canine Toxicology: Theobromine',
    sourceUrl: 'https://www.merckvetmanual.com/toxicology/food-hazards/chocolate-toxicosis-in-animals',
    text: 'Chocolate contains theobromine and caffeine (methylxanthines). Dogs metabolize theobromine much more slowly than humans. Clinical signs include vomiting, diarrhea, polyuria, restlessness, tachycardia, muscle tremors, seizures, and arrhythmias. Dark baker chocolate is significantly more toxic (up to 16 mg/g theobromine) compared to milk chocolate (approx 2 mg/g). Prompt veterinary evaluation, emesis induction within 2-4 hours if safe, and activated charcoal administration are critical.',
  },
  {
    id: 'vet-tox-002',
    category: 'toxicology',
    sourceTitle: 'ASPCA Animal Poison Control - Xylitol Ingestion in Canines',
    sourceUrl: 'https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants/xylitol',
    text: 'Xylitol is an artificial sweetener found in sugar-free gum, candy, peanut butter, and baked goods. In dogs, xylitol stimulates a rapid, potent insulin release resulting in life-threatening hypoglycemia within 30-60 minutes. Doses exceeding 0.1 g/kg cause severe hypoglycemia, while doses above 0.5 g/kg can precipitate acute hepatic necrosis and acute liver failure. Immediate IV dextrose and intensive veterinary hospitalization are vital.',
  },
  {
    id: 'vet-nutr-001',
    category: 'nutrition',
    sourceTitle: 'AAFCO Dog Food Nutrient Profiles & Dietary Guidelines',
    sourceUrl: 'https://www.aafco.org/consumers/understanding-pet-food/dog-food-nutrient-profiles/',
    text: 'Canine nutritional requirements vary substantially across life stages. Adult maintenance diets require minimum 18% crude protein (dry matter) and 5.5% fat, while growth/reproduction diets require at least 22.5% protein and 8.5% fat. Fresh clean water must be available at all times. Avoid sudden dietary changes which can provoke acute gastroenteritis; transition over 7-10 days by blending old and new foods.',
  },
  {
    id: 'vet-nutr-002',
    category: 'nutrition',
    sourceTitle: 'Cornell Feline Health Center - Feline Essential Dietary Requirements',
    sourceUrl: 'https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center',
    text: 'Cats are obligate carnivores requiring high-protein, meat-based diets. Unlike dogs, cats cannot synthesize taurine, arachidonic acid, or pre-formed vitamin A in adequate amounts. Taurine deficiency leads to central retinal degeneration, blindness, and dilated cardiomyopathy. Wet food helps maintain urinary tract hydration and reduces the incidence of feline lower urinary tract disease (FLUTD).',
  },
  {
    id: 'vet-derm-001',
    category: 'dermatology',
    sourceTitle: 'Veterinary Dermatology Society - Canine Allergic Dermatitis',
    sourceUrl: 'https://www.worldvetderm.org',
    text: 'Pruritus (itching, scratching, licking paws, rubbing muzzle) is the cardinal sign of allergic dermatitis in dogs. Primary causes include flea allergy dermatitis (FAD), environmental atopic dermatitis, and adverse food reactions. Secondary bacterial (Staphylococcus pseudintermedius) or Malassezia yeast infections exacerbate discomfort and require topical or systemic veterinary therapy.',
  },
  {
    id: 'vet-prev-001',
    category: 'preventive',
    sourceTitle: 'AAHA Canine Vaccination Guidelines',
    sourceUrl: 'https://www.aaha.org/aaha-guidelines/vaccination-canine-configuration/',
    text: 'Core canine vaccines include Distemper, Adenovirus-2 (Hepatitis), Parvovirus, and Parainfluenza (DHPP/DA2PP) along with Rabies. Puppy boosters are administered every 3-4 weeks from 6-8 weeks until at least 16 weeks of age, followed by a booster at 1 year and revaccination every 3 years. Non-core vaccines (Bordetella, Leptospira, Lyme) are recommended based on regional lifestyle risk.',
  },
  {
    id: 'vet-emerg-001',
    category: 'emergency',
    sourceTitle: 'Veterinary Emergency and Critical Care Society (VECCS) - Gastric Dilation-Volvulus (GDV)',
    sourceUrl: 'https://veccs.org',
    text: 'Gastric Dilatation-Volvulus (GDV or bloat) is an acute surgical emergency primarily affecting deep-chested large breed dogs. Signs include sudden abdominal distension, unproductive retching/vomiting, restlessness, pacing, hypersalivation, and pale gums. Untreated GDV leads to circulatory shock and is fatal within hours. Immediate veterinary decompression and emergency surgery (gastropexy) are required.',
  },
  {
    id: 'vet-dig-001',
    category: 'digestive',
    sourceTitle: 'Clinical Veterinary Advisor - Acute Enteritis and Vomiting',
    sourceUrl: 'https://www.sciencedirect.com/book/9780323048811/clinical-veterinary-advisor-dogs-and-cats',
    text: 'Acute vomiting and diarrhea in pets can arise from dietary indiscretion, parasites, viral enteritis (e.g. Parvovirus), foreign body obstruction, or pancreatitis. Mild single-episode vomiting with normal energy may respond to a temporary bland diet (boiled white rice and boneless skinless chicken). However, repeated vomiting, blood in stool, lethargy, or failure to keep water down requires immediate clinic examination.',
  },
  {
    id: 'vet-anorexia-001',
    category: 'digestive',
    sourceTitle: 'Merck Veterinary Manual - Anorexia and Inappetence in Small Animals',
    sourceUrl: 'https://www.merckvetmanual.com/digestive-system/anorexia-in-dogs-and-cats',
    text: 'Anorexia (prolonged refusal of food or loss of appetite) lasting 48 hours or more is a serious clinical sign in dogs and cats. Causes include systemic infections, metabolic disorders (such as kidney or liver disease), pancreatitis, gastrointestinal pain, or dental disease. In cats, prolonged anorexia carries high risk of hepatic lipidosis (fatty liver syndrome). Supportive care includes keeping fresh water accessible, keeping the pet calm and hydrated, and never force-feeding or administering human pain medications like ibuprofen, aspirin, or acetaminophen, which are highly toxic to pets. A veterinary examination is recommended promptly if inappetence exceeds 24-48 hours.',
  },
  {
    id: 'vet-derm-002',
    category: 'dermatology',
    sourceTitle: 'BSAVA Manual of Canine and Feline Dermatology - Erythema, Hot Spots, and Pruritus',
    sourceUrl: 'https://www.bsavalibrary.com/content/book/10.22233/9781910443217',
    text: 'Localized red patches (focal erythema), hair loss, and irritation on the neck, face, or trunk are commonly associated with acute moist dermatitis (hot spots), flea allergy dermatitis, superficial pyoderma, contact irritation, or dermatophytosis (ringworm). Visual inspection alone cannot definitively differentiate bacterial, fungal, or allergic causes because their visible presentations overlap significantly. In-clinic cytology, skin scrapes, or tape preps by a veterinarian are essential before applying medications, as steroids can severely worsen fungal infections.',
  },
  {
    id: 'vet-derm-003',
    category: 'dermatology',
    sourceTitle: 'Veterinary Clinics of North America - Otitis Externa and Head Shaking',
    sourceUrl: 'https://www.vet.theclinics.com/article/S0195-5616',
    text: 'Frequent head shaking, scratching at the ears, and ear redness are hallmark indicators of otitis externa (ear canal inflammation or infection). Contributing factors include ear canal moisture, atopic allergies, ear mites (Otodectes cynotis), or foreign debris like grass seeds. Vigorous scratching can rupture pinnal blood vessels leading to a painful aural hematoma. An otoscopic exam and veterinary cytology are needed to determine whether treatment requires antibacterial, antifungal, or anti-parasitic ear drops.',
  },
  {
    id: 'vet-behave-001',
    category: 'preventive',
    sourceTitle: 'Journal of Veterinary Behavior - Repetitive Behaviors and Clinical Evaluation',
    sourceUrl: 'https://www.journalvetbehavior.com',
    text: 'Repetitive behaviors in pets such as excessive licking, pacing, tail chasing, or abrupt behavioral changes are often secondary to underlying physical discomfort, pain, or pruritus rather than purely psychological causes. Veterinary guidelines require ruling out medical etiologies (such as dermatologic irritation, musculoskeletal pain, or neurological conditions) before diagnosing primary behavioral disorders like compulsive disorders or anxiety.',
  },
];

async function ingest() {
  console.log('🚀 Starting VetKnowledge RAG Ingestion Pipeline...');
  const chromaUrl = process.env.CHROMADB_URL || 'http://localhost:8000';
  const collectionName = process.env.CHROMA_COLLECTION || 'vetknowledge';

  console.log(`📡 Connecting to ChromaDB at: ${chromaUrl}`);
  const client = new ChromaClient({ path: chromaUrl });

  let collection;
  try {
    collection = await client.getOrCreateCollection({
      name: collectionName,
      metadata: { description: 'Veterinary clinical knowledge embeddings for PetCare AI' },
    });
    console.log(`✅ Collection "${collectionName}" ready.`);
  } catch (err: any) {
    console.error(`❌ Could not connect to ChromaDB at ${chromaUrl}:`, err.message);
    console.log('💡 Tip: Ensure ChromaDB is running via Docker: docker run -p 8000:8000 chromadb/chroma');
    return;
  }

  console.log(`📚 Preparing to embed and index ${VET_KNOWLEDGE_DOCUMENTS.length} clinical veterinary passages...`);

  const ids: string[] = [];
  const documents: string[] = [];
  const embeddings: number[][] = [];
  const metadatas: Record<string, any>[] = [];

  for (const doc of VET_KNOWLEDGE_DOCUMENTS) {
    try {
      console.log(`  🔍 Embedding: [${doc.category}] "${doc.sourceTitle}"...`);
      const emb = await generateEmbedding(doc.text);

      ids.push(doc.id);
      documents.push(doc.text);
      embeddings.push(emb);
      metadatas.push({
        source_title: doc.sourceTitle,
        source_url: doc.sourceUrl,
        category: doc.category,
      });
    } catch (err: any) {
      console.warn(`  ⚠️ Skipped ${doc.id}: ${err.message}`);
    }
  }

  if (ids.length === 0) {
    console.log('⚠️ No embeddings generated (check your OPENROUTER_API_KEY in .env).');
    return;
  }

  try {
    await collection.upsert({
      ids,
      documents,
      embeddings,
      metadatas,
    });
    const totalCount = await collection.count();
    console.log(`\n🎉 Ingestion complete! Total passages in "${collectionName}": ${totalCount}`);
  } catch (err: any) {
    console.error('❌ Failed to upsert documents into ChromaDB:', err.message);
  }
}

ingest().catch((err) => {
  console.error('Fatal ingestion error:', err);
  process.exit(1);
});
