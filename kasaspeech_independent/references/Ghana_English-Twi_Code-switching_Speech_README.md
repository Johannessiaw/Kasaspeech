---
license: apache-2.0
task_categories:
- text-to-speech
- automatic-speech-recognition
language:
- en
- tw
size_categories:
- 10K<n<100K
configs:
- config_name: default
  data_files:
  - split: train
    path: data/train-*
  - split: test
    path: data/test-*
  - split: validation
    path: data/validation-*
dataset_info:
  features:
  - name: speaker_id
    dtype: string
  - name: age_range
    dtype: string
  - name: gender
    dtype: string
  - name: prompt_set
    dtype: string
  - name: transcript
    dtype: string
  - name: duration
    dtype: float32
  - name: split
    dtype: string
  - name: audio
    dtype:
      audio:
        sampling_rate: 16000
  - name: file_name
    dtype: string
  - name: error
    dtype: string
  splits:
  - name: train
    num_bytes: 3333593525.0
    num_examples: 50965
  - name: test
    num_bytes: 237761150.395
    num_examples: 1731
  - name: validation
    num_bytes: 294212653.04
    num_examples: 2159
  download_size: 3997553997
  dataset_size: 3865567328.435
---
# Dataset Card for KasaSpeech

## Dataset Summary

**KasaSpeech** is a large-scale English–Twi code-switching speech dataset developed to advance research in speech technologies for English and Twi. 
The dataset comprises **54,855** transcribed speech recordings collected from speakers across Ghana and is designed to capture natural code-switching between English and Twi across a diverse range of everyday topics and communication scenarios


With over **95 hours** of manually transcribed speech, KasaSpeech establishes a new benchmark and gold-standard corpus for English–Twi code-switching speech recognition and text-to-speech research. It is designed to support the development, 
evaluation, and comparison of ASR systems, speech representation models, and multilingual speech technologies for English–Twi.
## Supported Tasks

KasaSpeech is suitable for:

* Automatic Speech Recognition (ASR) for Code-switching speech 
* Text-To-Speech (TTS)
* Multilingual speech modeling
* Speech representation learning
* Speech foundation model fine-tuning and evaluation
* African language speech technology research


## Dataset Structure

### Data Splits

| Split      |    Samples |        Duration |
| ---------- | ---------: | --------------: |
| Train      |     50,965 |     83.94 hours |
| Validation |      2,159 |      6.80 hours |
| Test       |      1,731 |      4.84 hours |
| **Total**  | **54,855** | **95.58 hours** |


### Data Fields

Each example contains the following fields:

| Field        | Type      | Description                                          |
| ------------ | --------- | ---------------------------------------------------- |
| `speaker_id` | `string`  | Anonymous speaker identifier                         |
| `age_range`  | `string`  | Speaker age group                                    |
| `gender`     | `string`  | Speaker gender                                       |
| `prompt_set` | `string`  | Prompt category used during recording                |
| `transcript` | `string`  | Human-annotated English–Twi code-switched transcript |
| `duration`   | `float32` | Audio duration in seconds                            |
| `split`      | `string`  | Dataset split (`train`, `validation`, or `test`)     |
| `audio`      | `Audio`   | Speech recording                                     |
| `file_name`  | `string`  | Original audio filename                              |
| `error`      | `string`  | Optional annotation or recording error label         |


## Example

```python
from datasets import load_dataset, Audio

dataset = load_dataset(
    "Kennethdot/Ghana_English-Twi_Code_switching_ASR",
    split="train"
)

dataset = dataset.cast_column(
    "audio",
    Audio(sampling_rate=16000)
)

sample = dataset[0]

print(sample["transcript"])
```

Example transcript:

```text
Me phone no a-crack-i, henfa na mɛtumi a-fix-i screen no?
```

## Dataset Creation

### Collection Process

Speech recordings were voluntarily contributed by participants using a custom data collection platform. Speakers were presented with prompts designed to encourage natural English–Twi code-switching while covering a broad range of everyday topics and communication scenarios.

### Annotation Process

All recordings were manually transcribed following standardized annotation guidelines developed for English–Twi code-switched speech. Multiple quality assurance steps were performed to improve transcription consistency and remove corrupted or invalid recordings.

### Speaker Information

The dataset includes recordings from speakers spanning multiple age groups and genders. Speaker identities have been anonymized using unique identifiers.

## Dataset Characteristics

* **Total recordings:** 54,855
* **Total duration:** 95.58 hours
* **Languages:** English, Twi, and English–Twi code-switching
* **Sampling rate:** 48 kHz (can be resampled to 16 kHz for model training)
* **Recording style:** Prompted, natural code-switched speech
* **Transcriptions:** Human-annotated

## Limitations

* Demographic representation may not be perfectly balanced across speaker groups.
* Recording conditions vary across devices and environments.
* The dataset primarily reflects Ghanaian English–Twi code-switching and may not generalize to all Akan dialects or other multilingual contexts.
* Although carefully curated, minor transcription inconsistencies may remain.


## Citation

If you use **KasaSpeech** in your work, please cite:

```bibtex
@dataset{kasaspeech2026,
  title={KasaSpeech: A Large-Scale English--Twi Code-Switching Speech Dataset},
  author={Dotse, Kenneth},
  year={2026},
  url={https://huggingface.co/datasets/Kennethdot/Ghana_English-Twi_Code_switching_ASR}
}
```

## Contact

For questions, bug reports, or collaboration opportunities, please open a discussion on the Hugging Face dataset page. Contributions, feedback, and research collaborations are welcome.