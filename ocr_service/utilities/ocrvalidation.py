import re
import difflib

def validate(result, validation_data):
    array_result = re.split('\n|:| ', result)
    array_result = list(filter(None, array_result))
    total_match = 0
    for data in validation_data:
        match = get_close_matches_icase(data, array_result, 4, 0.6)
        total_match = total_match+1 if len(match) > 0 else total_match
            
    return total_match

def get_close_matches_icase(word, possibilities, *args, **kwargs):
    """ Case-insensitive version of difflib.get_close_matches """
    lword = word.lower()
    lpos = {p.lower(): p for p in possibilities}
    lmatches = difflib.get_close_matches(lword, lpos.keys(), *args, **kwargs)
    return [lpos[m] for m in lmatches]
